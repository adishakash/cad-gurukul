'use strict';
/**
 * Assessment Question Selector Service
 * Selects questions for a student's diagnostic assessment based on:
 *   1. AssessmentProfileRule (profile-based targeting)
 *   2. QuestionTemplate pool (with difficulty/category/aiTag matching)
 *   3. Static fallback if AI/DB unavailable
 */

const prisma = require('../../config/database');
const logger = require('../../utils/logger');

const DEFAULT_QUESTION_COUNT = 10;

/**
 * Select questions for a student.
 * @param {object} opts
 * @param {string} opts.studentId
 * @param {string} [opts.assessmentType] - e.g. 'DIAGNOSTIC', 'PRACTICE'
 * @param {number} [opts.count]          - number of questions to return
 * @returns {Promise<Array>}
 */
const selectQuestionsForStudent = async ({ studentId, assessmentType = 'DIAGNOSTIC', count = DEFAULT_QUESTION_COUNT }) => {
  try {
    // Load student profile for targeting
    const student = await prisma.studentProfile.findUnique({
      where: { userId: studentId },
      select: { educationLevel: true, interests: true, targetCourse: true },
    }).catch(() => null);

    // Find matching profile rule
    let matchedRule = null;
    if (student) {
      const rules = await prisma.assessmentProfileRule.findMany({
        where: { isActive: true, assessmentType },
        orderBy: { priority: 'desc' },
      });

      for (const rule of rules) {
        const conditions = rule.conditions;
        const matches = Object.entries(conditions).every(([key, val]) => {
          if (key === 'educationLevel') return student.educationLevel === val;
          if (key === 'targetCourse')   return student.targetCourse === val;
          if (key === 'interests')      return (student.interests || []).includes(val);
          return true;
        });
        if (matches) { matchedRule = rule; break; }
      }
    }

    // Build question query from rule or defaults
    const whereClause = {
      isActive: true,
      assessmentType,
      ...(matchedRule?.filters || {}),
    };

    const questions = await prisma.questionTemplate.findMany({
      where: whereClause,
      orderBy: [{ difficulty: 'asc' }, { createdAt: 'desc' }],
      take: count * 3, // over-select then sample
      select: {
        id: true, questionText: true, options: true, difficulty: true,
        category: true, aiTag: true, assessmentType: true,
      },
    });

    // Shuffle and pick `count`
    const shuffled = questions.sort(() => Math.random() - 0.5).slice(0, count);

    if (shuffled.length === 0) {
      logger.warn('[QuestionSelector] No questions found, using static fallback', { studentId, assessmentType });
      return getStaticFallbackQuestions(count);
    }

    logger.info('[QuestionSelector] Questions selected', { studentId, count: shuffled.length, ruleId: matchedRule?.id });
    return shuffled;
  } catch (err) {
    logger.error('[QuestionSelector] Error selecting questions', { error: err.message });
    return getStaticFallbackQuestions(count);
  }
};

// ─── Static fallback ──────────────────────────────────────────────────────────

const STATIC_QUESTIONS = [
  { id: 'sq-1', questionText: 'Which software is widely used for 3D mechanical design?', options: ['AutoCAD', 'SolidWorks', 'Photoshop', 'CorelDRAW'], difficulty: 1, category: 'CAD_BASICS', aiTag: null },
  { id: 'sq-2', questionText: 'What does BIM stand for?', options: ['Building Information Modeling', 'Basic Interior Module', 'Blueprint Integration Map', 'None'], difficulty: 1, category: 'BIM_BASICS', aiTag: null },
  { id: 'sq-3', questionText: 'Which file format is used to share 3D models across platforms?', options: ['STEP', 'MP3', 'XLSX', 'PPTX'], difficulty: 2, category: 'CAD_BASICS', aiTag: null },
  { id: 'sq-4', questionText: 'What is finite element analysis (FEA) used for?', options: ['Stress simulation', 'Graphic design', 'Accounting', 'Marketing'], difficulty: 2, category: 'SIMULATION', aiTag: null },
  { id: 'sq-5', questionText: 'Which software is preferred for civil infrastructure projects?', options: ['STAAD.Pro', 'Blender', 'After Effects', 'Tally'], difficulty: 2, category: 'CIVIL', aiTag: null },
];

const getStaticFallbackQuestions = (count) => STATIC_QUESTIONS.slice(0, count);

module.exports = { selectQuestionsForStudent };
