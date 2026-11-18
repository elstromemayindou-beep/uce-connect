import { randomInt } from 'node:crypto';

const GAME_MODES = new Set(['qcm', 'vrai_faux', 'personnage', 'livre', 'vie_chretienne', 'citation', 'chronologie', 'lieux']);
GAME_MODES.add('4_images_1_mot');
const TOKENS_PER_CORRECT_ANSWER = 10;
const QUIZ_LEVELS = [
  { difficulty: 1, label: 'Découverte', min_points: 0 },
  { difficulty: 2, label: 'Explorateur', min_points: 80 },
  { difficulty: 3, label: 'Disciple', min_points: 200 },
  { difficulty: 4, label: 'Avancé', min_points: 400 },
  { difficulty: 5, label: 'Expert', min_points: 700 },
];

function quizError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function canManageQuiz(identity) {
  return identity.roles.some((role) => ['SUPER_ADMIN', 'ADMIN_GENERAL'].includes(role));
}

function normalizeAnswer(value) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/[^A-Z0-9]/g, '');
}

function createLetterBank(answerText) {
  const letters = [...normalizeAnswer(answerText)];
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  for (let index = 0; index < Math.max(4, Math.ceil(letters.length / 2)); index += 1) {
    letters.push(alphabet[randomInt(alphabet.length)]);
  }
  for (let index = letters.length - 1; index > 0; index -= 1) {
    const swapIndex = randomInt(index + 1);
    [letters[index], letters[swapIndex]] = [letters[swapIndex], letters[index]];
  }
  return letters;
}

function validateQuestion(payload) {
  const gameMode = payload?.game_mode;
  const difficulty = Number(payload?.difficulty);
  const prompt = typeof payload?.prompt === 'string' ? payload.prompt.trim() : '';
  const choices = payload?.choices;
  const correctOption = Number(payload?.correct_option);
  const answerText = typeof payload?.answer_text === 'string' ? payload.answer_text.trim() : '';
  const imageUrls = payload?.image_urls;
  const explanation = typeof payload?.explanation === 'string' ? payload.explanation.trim() : '';
  const bibleReference = typeof payload?.bible_reference === 'string' ? payload.bible_reference.trim() : '';
  if (!GAME_MODES.has(gameMode)
    || !Number.isInteger(difficulty) || difficulty < 1 || difficulty > 5
    || prompt.length < 5 || prompt.length > 500) {
    throw quizError(400, 'Le mode, le niveau ou l’intitulé de la question est invalide.');
  }
  if (gameMode === '4_images_1_mot') {
    if (!/^[\p{L}\p{N} ]{2,40}$/u.test(answerText)
      || !Array.isArray(imageUrls) || imageUrls.length !== 4
      || imageUrls.some((url) => typeof url !== 'string'
        || url.length > 2000
        || !(url.startsWith('/quiz-images/')
          || /^https:\/\//i.test(url))
        || url.startsWith('//'))
      || explanation.length > 1200 || bibleReference.length > 160
      || (payload?.is_active !== undefined && typeof payload.is_active !== 'boolean')) {
      throw quizError(400, 'Pour ce jeu, une réponse et quatre images valides sont obligatoires.');
    }
    return {
      gameMode,
      difficulty,
      prompt,
      choices: [],
      correctOption: -1,
      answerText,
      imageUrls,
      explanation,
      bibleReference,
      isActive: payload.is_active !== false,
    };
  }
  if (!Array.isArray(choices) || choices.length < 2 || choices.length > 6
    || choices.some((choice) => typeof choice !== 'string' || !choice.trim() || choice.trim().length > 180)
    || !Number.isInteger(correctOption) || correctOption < 0 || correctOption >= choices.length
    || explanation.length > 1200 || bibleReference.length > 160
    || (payload?.is_active !== undefined && typeof payload.is_active !== 'boolean')) {
    throw quizError(400, 'Les informations de la question sont invalides.');
  }
  return {
    gameMode,
    difficulty,
    prompt,
    choices: choices.map((choice) => choice.trim()),
    correctOption,
    answerText: '',
    imageUrls: [],
    explanation,
    bibleReference,
    isActive: payload.is_active !== false,
  };
}

function validateReward(payload) {
  const name = typeof payload?.name === 'string' ? payload.name.trim() : '';
  const description = typeof payload?.description === 'string' ? payload.description.trim() : '';
  const pointsRequired = Number(payload?.points_required);
  const stock = payload?.stock === '' || payload?.stock === undefined ? null : payload.stock;
  if (name.length < 2 || name.length > 120
    || description.length > 500
    || !Number.isSafeInteger(pointsRequired) || pointsRequired < 1
    || (stock !== null && (!Number.isSafeInteger(stock) || stock < 0))
    || (payload?.is_active !== undefined && typeof payload.is_active !== 'boolean')) {
    throw quizError(400, 'Les informations de la récompense sont invalides.');
  }
  return { name, description, pointsRequired, stock, isActive: payload.is_active !== false };
}

async function getPlayerPoints(tx, churchId, profileId) {
  const rows = await tx.$queryRaw`
    SELECT COALESCE(sum(points),0)::int AS points
    FROM public.uce_quiz_point_ledger
    WHERE eglise_id=${churchId}::uuid AND profile_id=${profileId}::uuid
  `;
  return rows[0].points;
}

function safeQuestion(question) {
  const result = {
    id: question.id,
    game_mode: question.game_mode,
    prompt: question.prompt,
    difficulty: question.difficulty,
  };
  if (question.game_mode === '4_images_1_mot') {
    return {
      ...result,
      image_urls: question.image_urls,
      answer_length: [...normalizeAnswer(question.answer_text)].length,
      letter_bank: createLetterBank(question.answer_text),
    };
  }
  return { ...result, choices: question.choices };
}

export function registerQuizRoutes(app, prisma) {
  app.get('/api/quiz/summary', async (request, response, next) => {
    try {
      const { eglise_id: churchId, id: profileId } = request.identity.profile;
      const [points, sessions, rewards, claims] = await Promise.all([
        getPlayerPoints(prisma, churchId, profileId),
        prisma.$queryRaw`
          SELECT count(*)::int AS completed_sessions
          FROM public.uce_quiz_sessions
          WHERE eglise_id=${churchId}::uuid AND profile_id=${profileId}::uuid AND status='completed'
        `,
        prisma.$queryRaw`
          SELECT r.id,r.name,r.description,r.points_required,r.stock,
            c.status AS claim_status,c.admin_note
          FROM public.uce_quiz_rewards r
          LEFT JOIN LATERAL (
            SELECT status,admin_note
            FROM public.uce_quiz_reward_claims
            WHERE eglise_id=r.eglise_id AND reward_id=r.id AND profile_id=${profileId}::uuid
            ORDER BY created_at DESC LIMIT 1
          ) c ON true
          WHERE r.eglise_id=${churchId}::uuid AND r.is_active=true
          ORDER BY r.points_required,r.created_at
        `,
        prisma.$queryRaw`
          SELECT id,reward_id,status,admin_note,created_at,reviewed_at
          FROM public.uce_quiz_reward_claims
          WHERE eglise_id=${churchId}::uuid AND profile_id=${profileId}::uuid
          ORDER BY created_at DESC LIMIT 20
        `,
      ]);
      response.json({
        points,
        completed_sessions: sessions[0].completed_sessions,
        levels: QUIZ_LEVELS,
        rewards,
        claims,
      });
    } catch (error) {
      next(error);
    }
  });

  app.post('/api/quiz/sessions', async (request, response, next) => {
    try {
      const gameMode = request.body?.game_mode;
      const difficulty = Number(request.body?.difficulty);
      if (!GAME_MODES.has(gameMode) || !Number.isInteger(difficulty) || difficulty < 1 || difficulty > 5) {
        response.status(400).json({ error: 'Le mode ou le niveau de jeu est invalide.' });
        return;
      }

      const result = await prisma.$transaction(async (tx) => {
        const { eglise_id: churchId, id: profileId } = request.identity.profile;
        const points = await getPlayerPoints(tx, churchId, profileId);
        const level = QUIZ_LEVELS.find((item) => item.difficulty === difficulty);
        if (points < level.min_points) {
          throw quizError(403, `Il faut ${level.min_points} jetons pour débloquer le niveau ${level.label}.`);
        }
        const questions = await tx.$queryRaw`
          SELECT id,game_mode,prompt,choices,difficulty,correct_option,answer_text,image_urls
          FROM public.uce_quiz_questions
          WHERE eglise_id=${churchId}::uuid AND game_mode=${gameMode}
            AND difficulty<=${difficulty} AND is_active=true
          ORDER BY (difficulty=${difficulty}) DESC,random()
          LIMIT 5
        `;
        if (!questions.length) {
          throw quizError(409, 'Aucune question active n’est disponible pour ce jeu et ce niveau.');
        }
        const questionIds = questions.map((question) => question.id);
        const choiceOrders = questions.map((question) => {
          if (question.game_mode === '4_images_1_mot') return [];
          const order = question.choices.map((_choice, index) => index);
          for (let index = order.length - 1; index > 0; index -= 1) {
            const swapIndex = randomInt(index + 1);
            [order[index], order[swapIndex]] = [order[swapIndex], order[index]];
          }
          return order;
        });
        const sessions = await tx.$queryRaw`
          INSERT INTO public.uce_quiz_sessions
            (eglise_id,profile_id,game_mode,difficulty,question_ids,choice_orders)
          VALUES (
            ${churchId}::uuid,${profileId}::uuid,${gameMode},${difficulty},
            ${questionIds}::uuid[],${JSON.stringify(choiceOrders)}::jsonb
          )
          RETURNING id,current_index,question_started_at
        `;
        return {
          id: sessions[0].id,
          game_mode: gameMode,
          question_index: 0,
          question_count: questions.length,
          question_started_at: sessions[0].question_started_at,
          question: safeQuestion({
            ...questions[0],
            choices: questions[0].game_mode === '4_images_1_mot'
              ? questions[0].choices
              : choiceOrders[0].map((choiceIndex) => questions[0].choices[choiceIndex]),
          }),
        };
      });
      response.status(201).json(result);
    } catch (error) {
      next(error);
    }
  });

  app.post('/api/quiz/sessions/:sessionId/answer', async (request, response, next) => {
    try {
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(request.params.sessionId)) {
        response.status(400).json({ error: 'La partie sélectionnée est invalide.' });
        return;
      }
      const { question_index: submittedIndex, choice, answer } = request.body || {};
      if (!Number.isInteger(submittedIndex)
        || (choice !== undefined && choice !== null && (!Number.isInteger(choice) || choice < 0 || choice > 5))
        || (answer !== undefined && (typeof answer !== 'string' || answer.length > 80))) {
        response.status(400).json({ error: 'La réponse sélectionnée est invalide.' });
        return;
      }
      const result = await prisma.$transaction(async (tx) => {
        const { eglise_id: churchId, id: profileId } = request.identity.profile;
        const sessions = await tx.$queryRaw`
          SELECT id,game_mode,difficulty,question_ids,choice_orders,current_index,question_started_at,answers,points,status
          FROM public.uce_quiz_sessions
          WHERE id=${request.params.sessionId}::uuid
            AND eglise_id=${churchId}::uuid AND profile_id=${profileId}::uuid
          FOR UPDATE
        `;
        const session = sessions[0];
        if (!session) throw quizError(404, 'Cette partie est introuvable.');
        if (session.status !== 'in_progress') throw quizError(409, 'Cette partie est déjà terminée.');
        if (submittedIndex !== session.current_index) throw quizError(409, 'Cette question a déjà reçu une réponse.');

        const elapsedRows = await tx.$queryRaw`
          SELECT GREATEST(0,EXTRACT(EPOCH FROM (clock_timestamp()-${session.question_started_at}::timestamptz))*1000)::float8 AS elapsed_ms
        `;
        const elapsedMs = Number(elapsedRows[0]?.elapsed_ms || 0);        const timedOut = elapsedMs >= 10_000;
        if (session.game_mode !== '4_images_1_mot' && (choice === undefined || choice === null) && !timedOut) {
          throw quizError(409, 'Attendez la fin du compte à rebours avant de passer la question.');
        }
        if (session.game_mode === '4_images_1_mot' && !answer && !timedOut) {
          throw quizError(400, 'Saisissez une réponse avant de la valider.');
        }
        const questionId = session.question_ids[session.current_index];
        const questionRows = await tx.$queryRaw`
          SELECT game_mode,correct_option,choices,difficulty,answer_text,image_urls,explanation,bible_reference
          FROM public.uce_quiz_questions
          WHERE id=${questionId}::uuid AND eglise_id=${churchId}::uuid
        `;
        if (!questionRows[0]) throw quizError(409, 'Une question de cette partie n’est plus disponible.');
        const question = questionRows[0];
        const choiceOrder = session.choice_orders[session.current_index] || [];
        if (session.game_mode !== '4_images_1_mot' && choice !== null && choice !== undefined
          && (!Number.isInteger(choice) || choice < 0 || choice >= choiceOrder.length)) {
          throw quizError(400, 'Le choix ne correspond pas à cette question.');
        }
        const correct = !timedOut && (session.game_mode === '4_images_1_mot'
          ? normalizeAnswer(answer || '') === normalizeAnswer(question.answer_text)
          : choiceOrder[choice] === question.correct_option);
        // Les jetons mesurent le nombre de bonnes réponses, de façon identique
        // pour tous les jeux et niveaux. La difficulté sert à la progression.
        const pointsAwarded = correct ? TOKENS_PER_CORRECT_ANSWER : 0;
        const sessionPoints = session.points + pointsAwarded;
        const answers = [...session.answers, {
          question_id: questionId,
          choice: timedOut || session.game_mode === '4_images_1_mot' ? null : choice,
          answer: session.game_mode === '4_images_1_mot' && !timedOut ? answer : null,
          correct,
          timed_out: timedOut,
          points: pointsAwarded,
        }];
        const nextIndex = session.current_index + 1;
        const finished = nextIndex >= session.question_ids.length;
        const updated = await tx.$queryRaw`
          UPDATE public.uce_quiz_sessions
          SET answers=${JSON.stringify(answers)}::jsonb,
            points=${sessionPoints},
            current_index=${nextIndex},
            status=${finished ? 'completed' : 'in_progress'},
            question_started_at=now(),
            completed_at=CASE WHEN ${finished} THEN now() ELSE NULL END
          WHERE id=${session.id}::uuid AND eglise_id=${churchId}::uuid
          RETURNING question_started_at
        `;
        if (finished && sessionPoints > 0) {
          await tx.$executeRaw`
            INSERT INTO public.uce_quiz_point_ledger (eglise_id,profile_id,session_id,points)
            VALUES (${churchId}::uuid,${profileId}::uuid,${session.id}::uuid,${sessionPoints})
            ON CONFLICT (eglise_id,profile_id,session_id) DO NOTHING
          `;
        }
        const nextQuestion = finished ? null : await tx.$queryRaw`
          SELECT id,game_mode,prompt,choices,difficulty,correct_option,answer_text,image_urls
          FROM public.uce_quiz_questions
          WHERE id=${session.question_ids[nextIndex]}::uuid AND eglise_id=${churchId}::uuid
        `;
        const totalPoints = await getPlayerPoints(tx, churchId, profileId);
        return {
          correct,
          timed_out: timedOut,
          points_awarded: pointsAwarded,
          correct_choice: session.game_mode === '4_images_1_mot'
            ? question.answer_text
            : question.choices[choiceOrder[question.correct_option]],
          explanation: question.explanation,
          bible_reference: question.bible_reference,
          session_points: sessionPoints,
          total_points: totalPoints,
          finished,
          question_index: nextIndex,
          question_count: session.question_ids.length,
          question_started_at: finished ? null : updated[0].question_started_at,
          question: nextQuestion?.[0] ? safeQuestion({
            ...nextQuestion[0],
            choices: session.game_mode === '4_images_1_mot'
              ? nextQuestion[0].choices
              : (session.choice_orders[nextIndex] || []).map((choiceIndex) => nextQuestion[0].choices[choiceIndex]),
          }) : null,
        };
      });
      response.json(result);
    } catch (error) {
      next(error);
    }
  });

  app.post('/api/quiz/rewards/:rewardId/claims', async (request, response, next) => {
    try {
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(request.params.rewardId)) {
        response.status(400).json({ error: 'La récompense sélectionnée est invalide.' });
        return;
      }
      const claim = await prisma.$transaction(async (tx) => {
        const { eglise_id: churchId, id: profileId } = request.identity.profile;
        const rewards = await tx.$queryRaw`
          SELECT id,name,points_required,stock FROM public.uce_quiz_rewards
          WHERE id=${request.params.rewardId}::uuid AND eglise_id=${churchId}::uuid AND is_active=true
          FOR UPDATE
        `;
        const reward = rewards[0];
        if (!reward) throw quizError(404, 'Cette récompense n’est plus disponible.');
        if (reward.stock !== null && reward.stock < 1) throw quizError(409, 'Cette récompense est actuellement en rupture de stock.');
        const points = await getPlayerPoints(tx, churchId, profileId);
        if (points < reward.points_required) throw quizError(403, 'Vous n’avez pas encore assez de jetons pour réclamer cette récompense.');
        const claims = await tx.$queryRaw`
          INSERT INTO public.uce_quiz_reward_claims (eglise_id,reward_id,profile_id)
          VALUES (${churchId}::uuid,${reward.id}::uuid,${profileId}::uuid)
          ON CONFLICT (eglise_id,profile_id,reward_id) WHERE status IN ('pending','approved') DO NOTHING
          RETURNING id,reward_id,status,created_at
        `;
        if (!claims[0]) throw quizError(409, 'Une demande pour cette récompense est déjà en cours ou validée.');
        return claims[0];
      });
      response.status(201).json(claim);
    } catch (error) {
      next(error);
    }
  });

  app.get('/api/admin/quiz/questions', async (request, response, next) => {
    try {
      if (!canManageQuiz(request.identity)) throw quizError(403, 'Vous n’avez pas les droits pour gérer le quiz.');
      const questions = await prisma.$queryRaw`
        SELECT id,game_mode,difficulty,prompt,choices,correct_option,answer_text,image_urls,explanation,bible_reference,
          is_active,created_at,updated_at
        FROM public.uce_quiz_questions
        WHERE eglise_id=${request.identity.profile.eglise_id}::uuid
        ORDER BY game_mode,difficulty,created_at DESC
      `;
      response.json(questions);
    } catch (error) {
      next(error);
    }
  });

  app.post('/api/admin/quiz/questions', async (request, response, next) => {
    try {
      if (!canManageQuiz(request.identity)) throw quizError(403, 'Vous n’avez pas les droits pour gérer le quiz.');
      const question = validateQuestion(request.body);
      const rows = await prisma.$queryRaw`
        INSERT INTO public.uce_quiz_questions
          (eglise_id,game_mode,difficulty,prompt,choices,correct_option,answer_text,image_urls,
            explanation,bible_reference,is_active,created_by)
        VALUES (
          ${request.identity.profile.eglise_id}::uuid,${question.gameMode},${question.difficulty},
          ${question.prompt},          ${JSON.stringify(question.choices)}::jsonb,${question.correctOption},${question.answerText},
          ${JSON.stringify(question.imageUrls)}::jsonb,
          ${question.explanation},${question.bibleReference},${question.isActive},
          ${request.identity.profile.id}::uuid
        )
        RETURNING id,game_mode,difficulty,prompt,choices,correct_option,answer_text,image_urls,
          explanation,bible_reference,is_active,created_at,updated_at
      `;
      response.status(201).json(rows[0]);
    } catch (error) {
      next(error);
    }
  });

  app.patch('/api/admin/quiz/questions/:questionId', async (request, response, next) => {
    try {
      if (!canManageQuiz(request.identity)) throw quizError(403, 'Vous n’avez pas les droits pour gérer le quiz.');
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(request.params.questionId)) {
        throw quizError(400, 'La question sélectionnée est invalide.');
      }
      const question = validateQuestion(request.body);
      const rows = await prisma.$queryRaw`
        UPDATE public.uce_quiz_questions
        SET game_mode=${question.gameMode},difficulty=${question.difficulty},prompt=${question.prompt},
          choices=${JSON.stringify(question.choices)}::jsonb,correct_option=${question.correctOption},
          answer_text=${question.answerText},image_urls=${JSON.stringify(question.imageUrls)}::jsonb,
          explanation=${question.explanation},bible_reference=${question.bibleReference},
          is_active=${question.isActive},updated_at=now()
        WHERE id=${request.params.questionId}::uuid
          AND eglise_id=${request.identity.profile.eglise_id}::uuid
        RETURNING id,game_mode,difficulty,prompt,choices,correct_option,answer_text,image_urls,
          explanation,bible_reference,is_active,created_at,updated_at
      `;
      if (!rows[0]) throw quizError(404, 'Cette question est introuvable.');
      response.json(rows[0]);
    } catch (error) {
      next(error);
    }
  });

  app.delete('/api/admin/quiz/questions/:questionId', async (request, response, next) => {
    try {
      if (!canManageQuiz(request.identity)) throw quizError(403, 'Vous n’avez pas les droits pour gérer le quiz.');
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(request.params.questionId)) {
        throw quizError(400, 'La question sélectionnée est invalide.');
      }
      const rows = await prisma.$queryRaw`
        UPDATE public.uce_quiz_questions SET is_active=false,updated_at=now()
        WHERE id=${request.params.questionId}::uuid
          AND eglise_id=${request.identity.profile.eglise_id}::uuid AND is_active=true
        RETURNING id
      `;
      if (!rows[0]) throw quizError(404, 'Cette question est introuvable ou déjà désactivée.');
      response.status(204).end();
    } catch (error) {
      next(error);
    }
  });

  app.get('/api/admin/quiz/rewards', async (request, response, next) => {
    try {
      if (!canManageQuiz(request.identity)) throw quizError(403, 'Vous n’avez pas les droits pour gérer le quiz.');
      const rewards = await prisma.$queryRaw`
        SELECT r.id,r.name,r.description,r.points_required,r.stock,r.is_active,r.created_at,r.updated_at,
          count(c.id)::int AS claim_count,
          count(c.id) FILTER (WHERE c.status='pending')::int AS pending_claim_count
        FROM public.uce_quiz_rewards r
        LEFT JOIN public.uce_quiz_reward_claims c ON c.reward_id=r.id AND c.eglise_id=r.eglise_id
        WHERE r.eglise_id=${request.identity.profile.eglise_id}::uuid
        GROUP BY r.id
        ORDER BY r.points_required,r.created_at
      `;
      response.json(rewards);
    } catch (error) {
      next(error);
    }
  });

  app.post('/api/admin/quiz/rewards', async (request, response, next) => {
    try {
      if (!canManageQuiz(request.identity)) throw quizError(403, 'Vous n’avez pas les droits pour gérer le quiz.');
      const reward = validateReward(request.body);
      const rows = await prisma.$queryRaw`
        INSERT INTO public.uce_quiz_rewards (eglise_id,name,description,points_required,stock,is_active)
        VALUES (${request.identity.profile.eglise_id}::uuid,${reward.name},${reward.description},
          ${reward.pointsRequired},${reward.stock},${reward.isActive})
        RETURNING id,name,description,points_required,stock,is_active,created_at,updated_at
      `;
      response.status(201).json(rows[0]);
    } catch (error) {
      next(error);
    }
  });

  app.patch('/api/admin/quiz/rewards/:rewardId', async (request, response, next) => {
    try {
      if (!canManageQuiz(request.identity)) throw quizError(403, 'Vous n’avez pas les droits pour gérer le quiz.');
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(request.params.rewardId)) {
        throw quizError(400, 'La récompense sélectionnée est invalide.');
      }
      const reward = validateReward(request.body);
      const rows = await prisma.$queryRaw`
        UPDATE public.uce_quiz_rewards
        SET name=${reward.name},description=${reward.description},points_required=${reward.pointsRequired},
          stock=${reward.stock},is_active=${reward.isActive},updated_at=now()
        WHERE id=${request.params.rewardId}::uuid AND eglise_id=${request.identity.profile.eglise_id}::uuid
        RETURNING id,name,description,points_required,stock,is_active,created_at,updated_at
      `;
      if (!rows[0]) throw quizError(404, 'Cette récompense est introuvable.');
      response.json(rows[0]);
    } catch (error) {
      next(error);
    }
  });

  app.delete('/api/admin/quiz/rewards/:rewardId', async (request, response, next) => {
    try {
      if (!canManageQuiz(request.identity)) throw quizError(403, 'Vous n’avez pas les droits pour gérer le quiz.');
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(request.params.rewardId)) {
        throw quizError(400, 'La récompense sélectionnée est invalide.');
      }
      const rows = await prisma.$queryRaw`
        UPDATE public.uce_quiz_rewards SET is_active=false,updated_at=now()
        WHERE id=${request.params.rewardId}::uuid AND eglise_id=${request.identity.profile.eglise_id}::uuid
          AND is_active=true
        RETURNING id
      `;
      if (!rows[0]) throw quizError(404, 'Cette récompense est introuvable ou déjà désactivée.');
      response.status(204).end();
    } catch (error) {
      next(error);
    }
  });

  app.get('/api/admin/quiz/claims', async (request, response, next) => {
    try {
      if (!canManageQuiz(request.identity)) throw quizError(403, 'Vous n’avez pas les droits pour gérer le quiz.');
      const claims = await prisma.$queryRaw`
        SELECT c.id,c.reward_id,c.profile_id,c.status,c.admin_note,c.created_at,c.reviewed_at,
          r.name AS reward_name,r.points_required,
          COALESCE(NULLIF(CONCAT_WS(' ',m.prenom,m.nom,m.postnom),''),p.nom_affichage,'Membre UCE') AS member_name,
          p.telephone AS member_phone
        FROM public.uce_quiz_reward_claims c
        JOIN public.uce_quiz_rewards r ON r.id=c.reward_id AND r.eglise_id=c.eglise_id
        JOIN public.profils_utilisateurs p ON p.id=c.profile_id AND p.eglise_id=c.eglise_id
        LEFT JOIN public.membres m ON m.profil_utilisateur_id=p.id AND m.eglise_id=p.eglise_id
        WHERE c.eglise_id=${request.identity.profile.eglise_id}::uuid
        ORDER BY (c.status='pending') DESC,c.created_at DESC
        LIMIT 500
      `;
      response.json(claims);
    } catch (error) {
      next(error);
    }
  });

  app.patch('/api/admin/quiz/claims/:claimId', async (request, response, next) => {
    try {
      if (!canManageQuiz(request.identity)) throw quizError(403, 'Vous n’avez pas les droits pour gérer le quiz.');
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(request.params.claimId)) {
        throw quizError(400, 'La demande sélectionnée est invalide.');
      }
      const status = request.body?.status;
      const adminNote = typeof request.body?.admin_note === 'string' ? request.body.admin_note.trim() : '';
      if (!['approved', 'rejected'].includes(status) || adminNote.length > 500) {
        throw quizError(400, 'La décision ou la note de traitement est invalide.');
      }
      const result = await prisma.$transaction(async (tx) => {
        const churchId = request.identity.profile.eglise_id;
        const claims = await tx.$queryRaw`
          SELECT c.id,c.status,r.id AS reward_id,r.stock
          FROM public.uce_quiz_reward_claims c
          JOIN public.uce_quiz_rewards r ON r.id=c.reward_id AND r.eglise_id=c.eglise_id
          WHERE c.id=${request.params.claimId}::uuid AND c.eglise_id=${churchId}::uuid
          FOR UPDATE OF c,r
        `;
        const claim = claims[0];
        if (!claim) throw quizError(404, 'Cette demande de récompense est introuvable.');
        if (claim.status !== 'pending') throw quizError(409, 'Cette demande a déjà été traitée.');
        if (status === 'approved' && claim.stock !== null && claim.stock < 1) {
          throw quizError(409, 'Le stock de cette récompense est épuisé.');
        }
        if (status === 'approved' && claim.stock !== null) {
          await tx.$executeRaw`
            UPDATE public.uce_quiz_rewards SET stock=stock-1,updated_at=now()
            WHERE id=${claim.reward_id}::uuid AND eglise_id=${churchId}::uuid AND stock>0
          `;
        }
        const rows = await tx.$queryRaw`
          UPDATE public.uce_quiz_reward_claims
          SET status=${status},admin_note=${adminNote},
            reviewed_by=${request.identity.profile.id}::uuid,reviewed_at=now()
          WHERE id=${claim.id}::uuid AND eglise_id=${churchId}::uuid
          RETURNING id,reward_id,status,admin_note,created_at,reviewed_at
        `;
        return rows[0];
      });
      response.json(result);
    } catch (error) {
      next(error);
    }
  });
}
