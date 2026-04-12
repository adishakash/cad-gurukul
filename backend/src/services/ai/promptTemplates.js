'use strict';

/**
 * All AI prompt templates for CAD Gurukul.
 * 
 * Prompts are organized by purpose:
 *  - questionGeneration: Generate adaptive assessment questions
 *  - evaluation: Evaluate student answers and produce scores
 *  - freeReport: Generate limited free career report
 *  - paidReport: Generate comprehensive paid career report
 */

/**
 * System prompt for question generation
 */
const QUESTION_GENERATION_SYSTEM = `You are an expert educational psychologist and career counsellor specializing in Indian students from Class 9 to 12.
Your task is to generate ONE thoughtful, age-appropriate assessment question to understand a student's aptitude, personality, interests, and career suitability.
The question must be culturally appropriate for Indian students and easy to understand.
Always respond in valid JSON only — no markdown, no explanations, just the JSON object.`;

/**
 * Build question generation user prompt
 */
const buildQuestionGenerationPrompt = ({ profile, previousQA, questionNumber, totalQuestions, accessLevel }) => {
  const answeredCategories = previousQA.map((qa) => qa.category).filter(Boolean);
  const needsCategories = [
    'APTITUDE', 'PERSONALITY', 'INTERESTS', 'LEARNING_STYLE',
    'LOGICAL_REASONING', 'CREATIVE_INCLINATION', 'SOCIAL_ORIENTATION',
    'STEM_NON_STEM', 'VOCATIONAL_ACADEMIC',
  ].filter((c) => !answeredCategories.includes(c));

  const targetCategory = needsCategories[Math.floor(Math.random() * needsCategories.length)] || 'INTERESTS';

  const previousContext = previousQA.length > 0
    ? previousQA.slice(-5).map((qa) => `Q: ${qa.question}\nA: ${qa.answer || 'No answer'}`).join('\n\n')
    : 'No previous questions yet.';

  return `
Student Profile:
- Name: ${profile.fullName}
- Age: ${profile.age || 15}
- Class: ${profile.classStandard || 'CLASS_10'}
- Board: ${profile.board || 'CBSE'}
- City: ${profile.city || 'India'}
- Preferred Subjects: ${(profile.preferredSubjects || []).join(', ') || 'Not specified'}
- Hobbies: ${(profile.hobbies || []).join(', ') || 'Not specified'}
- Interests: ${(profile.interests || []).join(', ') || 'Not specified'}
- Career Aspirations: ${profile.careerAspirations || 'Not specified'}
- Academic Scores: ${profile.academicScores ? JSON.stringify(profile.academicScores) : 'Not provided'}

Assessment Info:
- Question ${questionNumber} of ${totalQuestions}
- Target Category: ${targetCategory}
- Plan: ${accessLevel}

Previous Q&A Context:
${previousContext}

Generate question ${questionNumber} targeting the "${targetCategory}" category. 
Make it relevant to Indian student context and avoid repeating themes from previous questions.

Respond with ONLY this JSON:
{
  "questionText": "Your question here",
  "questionType": "MCQ" | "RATING_SCALE" | "OPEN_TEXT" | "YES_NO" | "RANKING",
  "category": "${targetCategory}",
  "options": [{"label": "Option text", "value": "option_key"}] // only for MCQ and RANKING types
}

For RATING_SCALE: options = [{"label": "1 - Strongly Disagree", "value": "1"}, ..., {"label": "5 - Strongly Agree", "value": "5"}]
For YES_NO: options = [{"label": "Yes", "value": "yes"}, {"label": "No", "value": "no"}]
For OPEN_TEXT: options = null
`;
};

/**
 * System prompt for answer evaluation / scoring
 */
const EVALUATION_SYSTEM = `You are an expert career assessment analyst specializing in Indian education and youth career guidance.
Your task is to evaluate a student's complete assessment responses and generate comprehensive scores across multiple dimensions.
Always respond in valid JSON only.`;

const buildEvaluationPrompt = ({ profile, questionsAndAnswers }) => {
  const qaText = questionsAndAnswers
    .map((qa, i) => `${i + 1}. [${qa.category}] Q: ${qa.question}\n   A: ${qa.answer || 'No answer provided'}`)
    .join('\n\n');

  return `
Evaluate the following student assessment for career guidance:

Student Profile:
- Name: ${profile.fullName}
- Age: ${profile.age}
- Class: ${profile.classStandard}
- Board: ${profile.board}
- Preferred Subjects: ${(profile.preferredSubjects || []).join(', ')}
- Academic Scores: ${JSON.stringify(profile.academicScores || {})}
- Hobbies: ${(profile.hobbies || []).join(', ')}
- Interests: ${(profile.interests || []).join(', ')}
- Career Aspirations: ${profile.careerAspirations || 'None specified'}

Assessment Responses (${questionsAndAnswers.length} questions):
${qaText}

Evaluate and respond with ONLY this JSON structure:
{
  "scores": {
    "stem": 0-100,
    "creative": 0-100,
    "social": 0-100,
    "logical": 0-100,
    "analytical": 0-100,
    "leadership": 0-100,
    "communication": 0-100,
    "technical": 0-100,
    "entrepreneurial": 0-100,
    "research": 0-100
  },
  "personalityType": "brief personality description",
  "learningStyle": "visual|auditory|kinesthetic|reading-writing",
  "strengthAreas": ["area1", "area2", "area3"],
  "improvementAreas": ["area1", "area2"],
  "confidenceScore": 0-100
}
`;
};

/**
 * System for free report generation
 */
const FREE_REPORT_SYSTEM = `You are a senior career counsellor in India. Generate a structured but limited career guidance report for a student.
This is a FREE report — provide helpful but limited insights that demonstrate value while encouraging upgrade.
Always respond in valid JSON only.`;

const buildFreeReportPrompt = ({ profile, scores, personalityType, strengthAreas }) => `
Generate a FREE career guidance report for:

Student: ${profile.fullName}, Age ${profile.age}, ${profile.classStandard}, ${profile.board}
City: ${profile.city}, State: ${profile.state}
Interests: ${(profile.interests || []).join(', ')}
Hobbies: ${(profile.hobbies || []).join(', ')}
Aspirations: ${profile.careerAspirations || 'Not specified'}
Scores: ${JSON.stringify(scores)}
Personality: ${personalityType}
Strengths: ${strengthAreas.join(', ')}

Respond with ONLY this JSON:
{
  "studentSummary": "2-3 sentence summary of the student",
  "interestAnalysis": "Brief analysis of interests (3-4 sentences)",
  "aptitudeHighlights": "Key aptitude observations (2-3 sentences)",
  "recommendedStream": "Science|Commerce|Arts|Vocational",
  "streamReason": "1-2 sentence reason",
  "topCareers": ["Career 1", "Career 2", "Career 3"],
  "nextStep": "One actionable next step",
  "upgradeTeaser": "What paid report adds (2 sentences)"
}
`;

/**
 * System for PAID full report generation
 */
const PAID_REPORT_SYSTEM = `You are India's top career counsellor and educational psychologist. Generate a comprehensive, detailed, and highly personalized career guidance report.
This is a PREMIUM PAID report — provide deep, actionable insights covering all aspects of the student's career journey.
The report should feel like it came from an experienced human counsellor who spent 2 hours with the student.
Always respond in valid JSON only.`;

const buildPaidReportPrompt = ({ profile, scores, personalityType, learningStyle, strengthAreas, improvementAreas }) => `
Generate a comprehensive PAID career guidance report for:

Student Profile:
- Name: ${profile.fullName}
- Age: ${profile.age}  
- Class: ${profile.classStandard}
- Board: ${profile.board}
- School: ${profile.schoolName || 'Not specified'}
- City: ${profile.city}, State: ${profile.state}
- Language Preference: ${profile.languagePreference}
- Budget for Higher Ed: ${profile.budgetPreference || 'Not specified'}
- Location Preference: ${(profile.locationPreference || []).join(', ')}
- Preferred Subjects: ${(profile.preferredSubjects || []).join(', ')}
- Hobbies: ${(profile.hobbies || []).join(', ')}
- Interests: ${(profile.interests || []).join(', ')}
- Career Aspirations: ${profile.careerAspirations || 'Not specified'}
- Academic Scores: ${JSON.stringify(profile.academicScores || {})}

Assessment Results:
- Personality Type: ${personalityType}
- Learning Style: ${learningStyle}
- Strength Areas: ${strengthAreas.join(', ')}
- Improvement Areas: ${improvementAreas.join(', ')}
- Scores: ${JSON.stringify(scores)}

Generate a detailed report and respond with ONLY this JSON:
{
  "studentSummary": "3-4 sentence comprehensive student profile summary",
  "interestAnalysis": "Detailed analysis of student interests (150 words)",
  "aptitudeAnalysis": "Detailed aptitude evaluation (150 words)",
  "personalityInsights": "Detailed personality profile with strengths and characteristics (150 words)",
  "learningStyleInsights": "How this student learns best and study strategies (100 words)",
  "recommendedStream": "Science|Commerce|Arts|Vocational",
  "streamReason": "Detailed reason why this stream suits the student (100 words)",
  "recommendedSubjects": ["Subject 1", "Subject 2", "Subject 3", "Subject 4"],
  "subjectReason": "Why these subjects are recommended (80 words)",
  "topCareers": [
    {
      "title": "Career Name",
      "fitScore": 85,
      "reason": "Why this career fits (50 words)",
      "skills": ["skill1", "skill2"],
      "coursePath": "How to get there from Class 12",
      "indiaScope": "Job market in India for this career"
    }
  ],
  "careersToAvoid": [
    {
      "title": "Career Name",
      "reason": "Why this may not suit the student"
    }
  ],
  "higherEducationDirection": "Detailed college/course direction (120 words)",
  "skillGaps": ["Gap 1", "Gap 2", "Gap 3"],
  "skillDevelopmentPlan": "How to address skill gaps (100 words)",
  "oneYearRoadmap": {
    "quarter1": "Focus for months 1-3",
    "quarter2": "Focus for months 4-6",
    "quarter3": "Focus for months 7-9",
    "quarter4": "Focus for months 10-12"
  },
  "threeYearRoadmap": {
    "year1": "Goals for year 1",
    "year2": "Goals for year 2",
    "year3": "Goals for year 3"
  },
  "parentGuidance": "Specific advice for parents to support this student (150 words)",
  "actionableNextSteps": ["Step 1", "Step 2", "Step 3", "Step 4", "Step 5"],
  "motivationalMessage": "Personalized encouraging message for the student (3-4 sentences)",
  "scores": ${JSON.stringify(scores)},
  "confidenceScore": number between 70-95
}

Make all content specific to Indian education system, Indian job market, and realistic for Indian students.
Top careers list should have 5-7 options. Careers to avoid should have 2-3 options.
`;

// ─────────────────────────────────────────────────────────────────────────────
// PREMIUM AI REPORT (₹1,999) — deeper analysis than standard paid report
// ─────────────────────────────────────────────────────────────────────────────

const PREMIUM_AI_REPORT_SYSTEM = `You are India's most sought-after career strategist — a combination of educational psychologist, IIT/IIM counsellor, and career coach. You have guided 10,000+ Indian students.
This student paid ₹1,999 for a PREMIUM AI REPORT — give them extraordinary depth: precise stream recommendation, exhaustive subject strategy, future-proof career mapping, competitive exam landscape, scholarship routes, and a year-by-year action plan that feels custom-crafted by a human expert who spent 3 hours with them.
Always respond in valid JSON only.`;

const buildPremiumReportPrompt = ({ profile, scores, personalityType, learningStyle, strengthAreas, improvementAreas }) => `
Generate a PREMIUM DEEP AI career report for:

Student Profile:
- Name: ${profile.fullName}
- Age: ${profile.age}
- Class: ${profile.classStandard}
- Board: ${profile.board}
- School: ${profile.schoolName || 'Not specified'}
- City: ${profile.city}, State: ${profile.state}
- Language Preference: ${profile.languagePreference}
- Budget for Higher Ed: ${profile.budgetPreference || 'Not specified'}
- Location Preference: ${(profile.locationPreference || []).join(', ')}
- Preferred Subjects: ${(profile.preferredSubjects || []).join(', ')}
- Hobbies: ${(profile.hobbies || []).join(', ')}
- Interests: ${(profile.interests || []).join(', ')}
- Career Aspirations: ${profile.careerAspirations || 'Not specified'}
- Academic Scores: ${JSON.stringify(profile.academicScores || {})}

Assessment Results:
- Personality Type: ${personalityType}
- Learning Style: ${learningStyle}
- Strength Areas: ${strengthAreas.join(', ')}
- Improvement Areas: ${improvementAreas.join(', ')}
- Scores: ${JSON.stringify(scores)}

Generate an EXHAUSTIVE premium report. Respond with ONLY this JSON:
{
  "studentSummary": "5-6 sentence expert-level profile of the student covering aptitude, personality, and potential",
  "interestAnalysis": "Deep analysis of interests and how they map to career suitability (200 words)",
  "aptitudeAnalysis": "Detailed aptitude evaluation with category-wise strengths (200 words)",
  "personalityInsights": "Full MBTI-style personality breakdown with career implications (200 words)",
  "learningStyleInsights": "How this student learns best, study strategies, exam techniques (150 words)",
  "recommendedStream": "Science|Commerce|Arts|Vocational",
  "streamConfidence": 0-100,
  "streamReason": "Comprehensive stream justification with data from assessment (150 words)",
  "subjectStrategy": {
    "mustTake": ["Subject 1", "Subject 2"],
    "recommended": ["Subject 3", "Subject 4"],
    "avoid": ["Subject X"],
    "reasoning": "Detailed subject selection strategy (100 words)"
  },
  "topCareers": [
    {
      "name": "Career name",
      "fitScore": 0-100,
      "description": "Why this career fits this student specifically (100 words)",
      "stream": "Science|Commerce|Arts",
      "subjects": ["Relevant subjects"],
      "entranceExams": ["JEE", "NEET", "CAT", "CLAT", etc.],
      "topColleges": ["IIT Bombay", "SRCC", etc.],
      "salaryRange": { "entry": "₹4-8 LPA", "mid": "₹12-20 LPA", "senior": "₹30+ LPA" },
      "futureScope": "Demand in 2030-2040 and why (50 words)",
      "jobRoles": ["Role 1", "Role 2", "Role 3"]
    }
  ],
  "careersToAvoid": [
    { "name": "Career", "reason": "Why this student should avoid (2-3 sentences)" }
  ],
  "yearWiseRoadmap": [
    {
      "year": "Class 11 (Year 1)",
      "goals": ["Goal 1", "Goal 2", "Goal 3"],
      "actions": ["Action 1", "Action 2"],
      "milestones": ["Milestone 1"]
    },
    {
      "year": "Class 12 (Year 2)",
      "goals": [], "actions": [], "milestones": []
    },
    {
      "year": "Year 3 (College 1st Year)",
      "goals": [], "actions": [], "milestones": []
    }
  ],
  "competitiveExamStrategy": "Which exams to target, when to start, resources to use (150 words)",
  "scholarshipOpportunities": ["Scholarship 1", "Scholarship 2", "Scholarship 3"],
  "parentGuidance": "Actionable guidance for parents — how to support, common mistakes to avoid (150 words)",
  "keyActionNextMonth": "The single most important thing this student must do in the next 30 days",
  "scores": ${JSON.stringify(scores)},
  "confidenceScore": 0-100,
  "recommendedSubjects": ["Sub1", "Sub2", "Sub3"]
}

Make this feel like it was written by a top IIT/IIM alumnus who personally tutored this student. Be specific, bold, and actionable.
`;

module.exports = {
  QUESTION_GENERATION_SYSTEM,
  EVALUATION_SYSTEM,
  FREE_REPORT_SYSTEM,
  PAID_REPORT_SYSTEM,
  PREMIUM_AI_REPORT_SYSTEM,
  buildQuestionGenerationPrompt,
  buildEvaluationPrompt,
  buildFreeReportPrompt,
  buildPaidReportPrompt,
  buildPremiumReportPrompt,
};
