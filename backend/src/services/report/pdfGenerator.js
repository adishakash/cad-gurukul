'use strict';
const fs = require('fs');
const puppeteer = require('puppeteer');
const logger = require('../../utils/logger');

const LANGUAGE_CODE_MAP = {
  en: 'en',
  english: 'en',
  hi: 'hi',
  hindi: 'hi',
  bn: 'bn',
  bengali: 'bn',
  te: 'te',
  telugu: 'te',
  mr: 'mr',
  marathi: 'mr',
  ta: 'ta',
  tamil: 'ta',
  ur: 'ur',
  urdu: 'ur',
  gu: 'gu',
  gujarati: 'gu',
  kn: 'kn',
  kannada: 'kn',
  ml: 'ml',
  malayalam: 'ml',
  or: 'or',
  odia: 'or',
  pa: 'pa',
  punjabi: 'pa',
};

const LANGUAGE_LOCALE_MAP = {
  en: 'en-IN',
  hi: 'hi-IN',
  bn: 'bn-IN',
  te: 'te-IN',
  mr: 'mr-IN',
  ta: 'ta-IN',
  ur: 'ur-IN',
  gu: 'gu-IN',
  kn: 'kn-IN',
  ml: 'ml-IN',
  or: 'or-IN',
  pa: 'pa-IN',
};

const REPORT_TRANSLATIONS = {
  en: {
    title: 'CAD Gurukul – Career Guidance Report',
    subtitle: 'AI-Powered Career Guidance Platform for Indian Students',
    badge: '✦ CAREER REPORT ✦',
    generatedOn: 'Generated on {{date}}',
    confidenceScore: 'Confidence Score',
    sections: {
      studentSummary: '👤 Student Profile Summary',
      interestAnalysis: '🎯 Interest Analysis',
      aptitudeAnalysis: '🧠 Aptitude Analysis',
      personalityInsights: '🌟 Personality Insights',
      scores: '📊 Skill & Aptitude Scores',
      recommendedStream: '🎓 Recommended Stream',
      topCareers: '🚀 Top Career Recommendations',
      higherEducation: '🏫 Higher Education Direction',
      skillGaps: '⚡ Skill Gaps to Address',
      roadmap: '📅 Career Roadmap',
      nextSteps: '✅ Actionable Next Steps',
      parentGuidance: '👨‍👩‍👧 Parent Guidance',
      messageForYou: '💫 A Message for You',
    },
    labels: {
      type: 'Type',
      learningStyle: 'Learning Style',
      recommendedSubjects: 'Recommended Subjects',
      path: 'Path',
      indiaScope: 'India Scope',
      stream: 'Stream',
      fitScore: 'Fit Score',
    },
    roadmap: {
      oneYear: '1-Year Action Plan',
      threeYear: '3-Year Career Roadmap',
      quarter: 'Q{{quarter}} (Months {{range}}): {{text}}',
      year: 'Year {{year}}: {{text}}',
      goal: 'Goal',
      action: 'Action',
      milestone: 'Milestone',
    },
    scoreLabels: {
      stem: 'STEM',
      creative: 'Creative',
      social: 'Social',
      logical: 'Logical',
      analytical: 'Analytical',
      leadership: 'Leadership',
      communication: 'Communication',
      technical: 'Technical',
      entrepreneurial: 'Entrepreneurial',
      research: 'Research',
    },
  },
  hi: {
    title: 'CAD Gurukul – करियर मार्गदर्शन रिपोर्ट',
    subtitle: 'भारतीय छात्रों के लिए AI-आधारित करियर मार्गदर्शन प्लेटफॉर्म',
    badge: '✦ करियर रिपोर्ट ✦',
    generatedOn: 'जनरेटेड: {{date}}',
    confidenceScore: 'विश्वास स्कोर',
    sections: {
      studentSummary: '👤 छात्र प्रोफाइल सारांश',
      interestAnalysis: '🎯 रुचि विश्लेषण',
      aptitudeAnalysis: '🧠 क्षमता विश्लेषण',
      personalityInsights: '🌟 व्यक्तित्व अंतर्दृष्टि',
      scores: '📊 कौशल व क्षमता स्कोर',
      recommendedStream: '🎓 अनुशंसित स्ट्रीम',
      topCareers: '🚀 शीर्ष करियर सिफारिशें',
      higherEducation: '🏫 उच्च शिक्षा दिशा',
      skillGaps: '⚡ सुधार योग्य कौशल',
      roadmap: '📅 करियर रोडमैप',
      nextSteps: '✅ अगली कार्रवाई के कदम',
      parentGuidance: '👨‍👩‍👧 माता-पिता मार्गदर्शन',
      messageForYou: '💫 आपके लिए संदेश',
    },
    labels: {
      type: 'प्रकार',
      learningStyle: 'सीखने की शैली',
      recommendedSubjects: 'अनुशंसित विषय',
      path: 'पथ',
      indiaScope: 'भारत में अवसर',
      stream: 'स्ट्रीम',
      fitScore: 'फिट स्कोर',
    },
    roadmap: {
      oneYear: '1-वर्षीय कार्य योजना',
      threeYear: '3-वर्षीय करियर रोडमैप',
      quarter: 'Q{{quarter}} (महीने {{range}}): {{text}}',
      year: 'वर्ष {{year}}: {{text}}',
      goal: 'लक्ष्य',
      action: 'कार्य',
      milestone: 'माइलस्टोन',
    },
    scoreLabels: {
      stem: 'STEM',
      creative: 'रचनात्मक',
      social: 'सामाजिक',
      logical: 'तार्किक',
      analytical: 'विश्लेषणात्मक',
      leadership: 'नेतृत्व',
      communication: 'संचार',
      technical: 'तकनीकी',
      entrepreneurial: 'उद्यमशील',
      research: 'अनुसंधान',
    },
  },
  bn: {
    title: 'CAD Gurukul – ক্যারিয়ার গাইডেন্স রিপোর্ট',
    subtitle: 'ভারতীয় শিক্ষার্থীদের জন্য AI-চালিত ক্যারিয়ার গাইডেন্স প্ল্যাটফর্ম',
    badge: '✦ ক্যারিয়ার রিপোর্ট ✦',
    generatedOn: 'তৈরি হয়েছে: {{date}}',
    confidenceScore: 'আত্মবিশ্বাস স্কোর',
    sections: {
      studentSummary: '👤 শিক্ষার্থীর প্রোফাইল সারাংশ',
      interestAnalysis: '🎯 আগ্রহ বিশ্লেষণ',
      aptitudeAnalysis: '🧠 দক্ষতা বিশ্লেষণ',
      personalityInsights: '🌟 ব্যক্তিত্ব অন্তর্দৃষ্টি',
      scores: '📊 দক্ষতা ও প্রবণতার স্কোর',
      recommendedStream: '🎓 প্রস্তাবিত স্ট্রিম',
      topCareers: '🚀 শীর্ষ ক্যারিয়ার সুপারিশ',
      higherEducation: '🏫 উচ্চশিক্ষার দিকনির্দেশনা',
      skillGaps: '⚡ উন্নত করার দক্ষতা',
      roadmap: '📅 ক্যারিয়ার রোডম্যাপ',
      nextSteps: '✅ পরবর্তী করণীয়',
      parentGuidance: '👨‍👩‍👧 অভিভাবকদের জন্য নির্দেশনা',
      messageForYou: '💫 আপনার জন্য বার্তা',
    },
    labels: {
      type: 'ধরন',
      learningStyle: 'শেখার ধরণ',
      recommendedSubjects: 'প্রস্তাবিত বিষয়',
      path: 'পথ',
      indiaScope: 'ভারতে সুযোগ',
      stream: 'স্ট্রিম',
      fitScore: 'ফিট স্কোর',
    },
    roadmap: {
      oneYear: '১-বছরের অ্যাকশন প্ল্যান',
      threeYear: '৩-বছরের ক্যারিয়ার রোডম্যাপ',
      quarter: 'Q{{quarter}} (মাস {{range}}): {{text}}',
      year: 'বছর {{year}}: {{text}}',
      goal: 'লক্ষ্য',
      action: 'কর্ম',
      milestone: 'মাইলস্টোন',
    },
    scoreLabels: {
      stem: 'STEM',
      creative: 'সৃজনশীল',
      social: 'সামাজিক',
      logical: 'যুক্তিবোধ',
      analytical: 'বিশ্লেষণমূলক',
      leadership: 'নেতৃত্ব',
      communication: 'যোগাযোগ',
      technical: 'প্রযুক্তিগত',
      entrepreneurial: 'উদ্যোক্তা',
      research: 'গবেষণা',
    },
  },
  te: {
    title: 'CAD Gurukul – కెరీర్ మార్గదర్శక నివేదిక',
    subtitle: 'భారతీయ విద్యార్థుల కోసం AI ఆధారిత కెరీర్ మార్గదర్శక వేదిక',
    badge: '✦ కెరీర్ నివేదిక ✦',
    generatedOn: 'సృష్టించిన తేదీ: {{date}}',
    confidenceScore: 'నమ్మకం స్కోర్',
    sections: {
      studentSummary: '👤 విద్యార్థి ప్రొఫైల్ సారాంశం',
      interestAnalysis: '🎯 ఆసక్తుల విశ్లేషణ',
      aptitudeAnalysis: '🧠 సామర్థ్య విశ్లేషణ',
      personalityInsights: '🌟 వ్యక్తిత్వ విశ్లేషణ',
      scores: '📊 నైపుణ్య & సామర్థ్య స్కోర్లు',
      recommendedStream: '🎓 సిఫార్సు చేసిన స్ట్రీమ్',
      topCareers: '🚀 శ్రేష్ఠ కెరీర్ సిఫార్సులు',
      higherEducation: '🏫 ఉన్నత విద్య దిశ',
      skillGaps: '⚡ మెరుగుపరచాల్సిన నైపుణ్యాలు',
      roadmap: '📅 కెరీర్ రోడ్‌మాప్',
      nextSteps: '✅ తదుపరి చర్యలు',
      parentGuidance: '👨‍👩‍👧 తల్లిదండ్రుల మార్గదర్శకం',
      messageForYou: '💫 మీ కోసం సందేశం',
    },
    labels: {
      type: 'రకం',
      learningStyle: 'నేర్చుకునే శైలి',
      recommendedSubjects: 'సిఫార్సు చేసిన సబ్జెక్టులు',
      path: 'పథం',
      indiaScope: 'భారతంలో అవకాశం',
      stream: 'స్ట్రీమ్',
      fitScore: 'ఫిట్ స్కోర్',
    },
    roadmap: {
      oneYear: '1-సంవత్సర కార్యాచరణ ప్రణాళిక',
      threeYear: '3-సంవత్సర కెరీర్ రోడ్‌మాప్',
      quarter: 'Q{{quarter}} (నెలలు {{range}}): {{text}}',
      year: 'సంవత్సరం {{year}}: {{text}}',
      goal: 'లక్ష్యం',
      action: 'చర్య',
      milestone: 'మైలుస్టోన్',
    },
    scoreLabels: {
      stem: 'STEM',
      creative: 'సృజనాత్మక',
      social: 'సామాజిక',
      logical: 'తార్కిక',
      analytical: 'విశ్లేషణాత్మక',
      leadership: 'నాయకత్వం',
      communication: 'సంప్రదింపులు',
      technical: 'సాంకేతిక',
      entrepreneurial: 'ఉద్యమాత్మక',
      research: 'పరిశోధన',
    },
  },
  mr: {
    title: 'CAD Gurukul – करिअर मार्गदर्शन अहवाल',
    subtitle: 'भारतीय विद्यार्थ्यांसाठी AI-संचालित करिअर मार्गदर्शन व्यासपीठ',
    badge: '✦ करिअर रिपोर्ट ✦',
    generatedOn: 'तयार केले: {{date}}',
    confidenceScore: 'आत्मविश्वास स्कोअर',
    sections: {
      studentSummary: '👤 विद्यार्थी प्रोफाइल सारांश',
      interestAnalysis: '🎯 आवडीचे विश्लेषण',
      aptitudeAnalysis: '🧠 क्षमता विश्लेषण',
      personalityInsights: '🌟 व्यक्तिमत्त्व अंतर्दृष्टी',
      scores: '📊 कौशल्य व क्षमता स्कोअर',
      recommendedStream: '🎓 सुचवलेली स्ट्रीम',
      topCareers: '🚀 टॉप करिअर शिफारसी',
      higherEducation: '🏫 उच्च शिक्षण दिशा',
      skillGaps: '⚡ सुधारायची कौशल्ये',
      roadmap: '📅 करिअर रोडमॅप',
      nextSteps: '✅ पुढील कृती',
      parentGuidance: '👨‍👩‍👧 पालकांसाठी मार्गदर्शन',
      messageForYou: '💫 तुमच्यासाठी संदेश',
    },
    labels: {
      type: 'प्रकार',
      learningStyle: 'शिकण्याची शैली',
      recommendedSubjects: 'सुचवलेले विषय',
      path: 'पथ',
      indiaScope: 'भारतामधील संधी',
      stream: 'स्ट्रीम',
      fitScore: 'फिट स्कोअर',
    },
    roadmap: {
      oneYear: '1-वर्ष कृती आराखडा',
      threeYear: '3-वर्ष करिअर रोडमॅप',
      quarter: 'Q{{quarter}} (महिने {{range}}): {{text}}',
      year: 'वर्ष {{year}}: {{text}}',
      goal: 'उद्दिष्ट',
      action: 'कृती',
      milestone: 'टप्पा',
    },
    scoreLabels: {
      stem: 'STEM',
      creative: 'सर्जनशील',
      social: 'सामाजिक',
      logical: 'तार्किक',
      analytical: 'विश्लेषणात्मक',
      leadership: 'नेतृत्व',
      communication: 'संवाद',
      technical: 'तांत्रिक',
      entrepreneurial: 'उद्योजकीय',
      research: 'संशोधन',
    },
  },
  ta: {
    title: 'CAD Gurukul – தொழில் வழிகாட்டு அறிக்கை',
    subtitle: 'இந்திய மாணவர்களுக்கு AI ஆதாரமான தொழில் வழிகாட்டு தளம்',
    badge: '✦ தொழில் அறிக்கை ✦',
    generatedOn: 'உருவாக்கப்பட்ட தேதி: {{date}}',
    confidenceScore: 'நம்பிக்கை மதிப்பெண்',
    sections: {
      studentSummary: '👤 மாணவர் சுருக்கம்',
      interestAnalysis: '🎯 விருப்பங்கள் பகுப்பாய்வு',
      aptitudeAnalysis: '🧠 திறன் பகுப்பாய்வு',
      personalityInsights: '🌟 தன்மை பார்வைகள்',
      scores: '📊 திறன் & புலமை மதிப்பெண்கள்',
      recommendedStream: '🎓 பரிந்துரைக்கப்படும் ஸ்ட்ரீம்',
      topCareers: '🚀 முன்னணி தொழில் பரிந்துரைகள்',
      higherEducation: '🏫 உயர்கல்வி வழிமுறை',
      skillGaps: '⚡ மேம்படுத்த வேண்டிய திறன்கள்',
      roadmap: '📅 தொழில் ரோட்மாப்',
      nextSteps: '✅ அடுத்த படிகள்',
      parentGuidance: '👨‍👩‍👧 பெற்றோர் வழிகாட்டு',
      messageForYou: '💫 உங்களுக்கு ஒரு செய்தி',
    },
    labels: {
      type: 'வகை',
      learningStyle: 'கற்றல் முறை',
      recommendedSubjects: 'பரிந்துரைக்கப்பட்ட பாடங்கள்',
      path: 'பாதை',
      indiaScope: 'இந்தியாவில் வாய்ப்புகள்',
      stream: 'ஸ்ட்ரீம்',
      fitScore: 'பொருந்தும் மதிப்பெண்',
    },
    roadmap: {
      oneYear: '1-ஆண்டு செயல் திட்டம்',
      threeYear: '3-ஆண்டு தொழில் ரோட்மாப்',
      quarter: 'Q{{quarter}} (மாதங்கள் {{range}}): {{text}}',
      year: 'ஆண்டு {{year}}: {{text}}',
      goal: 'இலக்கு',
      action: 'செயல்',
      milestone: 'மைல்கல்',
    },
    scoreLabels: {
      stem: 'STEM',
      creative: 'படைப்பாற்றல்',
      social: 'சமூக',
      logical: 'தர்க்கபூர்வ',
      analytical: 'பகுப்பாய்வு',
      leadership: 'தலைமைத் திறன்',
      communication: 'தொடர்பு',
      technical: 'தொழில்நுட்ப',
      entrepreneurial: 'தொழில் முனைவு',
      research: 'ஆராய்ச்சி',
    },
  },
  ur: {
    title: 'CAD Gurukul – کیریئر گائیڈنس رپورٹ',
    subtitle: 'بھارتی طلبہ کے لیے AI پر مبنی کیریئر گائیڈنس پلیٹ فارم',
    badge: '✦ کیریئر رپورٹ ✦',
    generatedOn: 'تیار کردہ: {{date}}',
    confidenceScore: 'اعتماد اسکور',
    sections: {
      studentSummary: '👤 طالب علم پروفائل خلاصہ',
      interestAnalysis: '🎯 دلچسپیوں کا تجزیہ',
      aptitudeAnalysis: '🧠 صلاحیت کا تجزیہ',
      personalityInsights: '🌟 شخصیت کی بصیرت',
      scores: '📊 مہارت و صلاحیت اسکورز',
      recommendedStream: '🎓 تجویز کردہ اسٹریم',
      topCareers: '🚀 بہترین کیریئر سفارشات',
      higherEducation: '🏫 اعلیٰ تعلیم کی سمت',
      skillGaps: '⚡ بہتر بنانے کی مہارتیں',
      roadmap: '📅 کیریئر روڈ میپ',
      nextSteps: '✅ اگلے اقدامات',
      parentGuidance: '👨‍👩‍👧 والدین کے لیے رہنمائی',
      messageForYou: '💫 آپ کے لیے پیغام',
    },
    labels: {
      type: 'قسم',
      learningStyle: 'سیکھنے کا انداز',
      recommendedSubjects: 'تجویز کردہ مضامین',
      path: 'راستہ',
      indiaScope: 'بھارت میں مواقع',
      stream: 'اسٹریم',
      fitScore: 'فِٹ اسکور',
    },
    roadmap: {
      oneYear: '1-سالہ عمل پلان',
      threeYear: '3-سالہ کیریئر روڈ میپ',
      quarter: 'Q{{quarter}} (مہینے {{range}}): {{text}}',
      year: 'سال {{year}}: {{text}}',
      goal: 'ہدف',
      action: 'عمل',
      milestone: 'اہم سنگِ میل',
    },
    scoreLabels: {
      stem: 'STEM',
      creative: 'تخلیقی',
      social: 'سماجی',
      logical: 'منطقی',
      analytical: 'تحلیلی',
      leadership: 'قیادت',
      communication: 'ابلاغ',
      technical: 'تکنیکی',
      entrepreneurial: 'کاروباری',
      research: 'تحقیق',
    },
  },
  gu: {
    title: 'CAD Gurukul – કારકિર્દી માર્ગદર્શન અહેવાલ',
    subtitle: 'ભારતીય વિદ્યાર્થીઓ માટે AI આધારિત કારકિર્દી માર્ગદર્શન પ્લેટફોર્મ',
    badge: '✦ કારકિર્દી અહેવાલ ✦',
    generatedOn: 'તૈયાર કરેલ: {{date}}',
    confidenceScore: 'આત્મવિશ્વાસ સ્કોર',
    sections: {
      studentSummary: '👤 વિદ્યાર્થી પ્રોફાઇલ સારાંશ',
      interestAnalysis: '🎯 રસ વિશ્લેષણ',
      aptitudeAnalysis: '🧠 ક્ષમતાનો વિશ્લેષણ',
      personalityInsights: '🌟 વ્યક્તિગત અંદાજ',
      scores: '📊 કૌશલ્ય અને ક્ષમતા સ્કોર',
      recommendedStream: '🎓 ભલામણ કરેલી સ્ટ્રીમ',
      topCareers: '🚀 ટોચના કારકિર્દી સૂચનો',
      higherEducation: '🏫 ઉચ્ચ શિક્ષણ દિશા',
      skillGaps: '⚡ સુધારવાના કૌશલ્યો',
      roadmap: '📅 કારકિર્દી રોડમૅપ',
      nextSteps: '✅ આગળના પગલાં',
      parentGuidance: '👨‍👩‍👧 માતા-પિતા માર્ગદર્શન',
      messageForYou: '💫 તમારા માટે સંદેશ',
    },
    labels: {
      type: 'પ્રકાર',
      learningStyle: 'શીખવાની રીત',
      recommendedSubjects: 'ભલામણ કરેલ વિષયો',
      path: 'માર્ગ',
      indiaScope: 'ભારતમાં તક',
      stream: 'સ્ટ્રીમ',
      fitScore: 'ફિટ સ્કોર',
    },
    roadmap: {
      oneYear: '1-વર્ષની કાર્ય યોજના',
      threeYear: '3-વર્ષની કારકિર્દી રોડમૅપ',
      quarter: 'Q{{quarter}} (મહિના {{range}}): {{text}}',
      year: 'વર્ષ {{year}}: {{text}}',
      goal: 'લક્ષ્ય',
      action: 'ક્રિયા',
      milestone: 'માઇલસ્ટોન',
    },
    scoreLabels: {
      stem: 'STEM',
      creative: 'સર્જનાત્મક',
      social: 'સામાજિક',
      logical: 'તાર્કિક',
      analytical: 'વિશ્લેષણાત્મક',
      leadership: 'નેતૃત્વ',
      communication: 'સંવાદ',
      technical: 'ટેકનિકલ',
      entrepreneurial: 'ઉદ્યોગસાહસિક',
      research: 'શોધ',
    },
  },
  kn: {
    title: 'CAD Gurukul – ವೃತ್ತಿ ಮಾರ್ಗದರ್ಶನ ವರದಿ',
    subtitle: 'ಭಾರತೀಯ ವಿದ್ಯಾರ್ಥಿಗಳಿಗಾಗಿ AI ಆಧಾರಿತ ವೃತ್ತಿ ಮಾರ್ಗದರ್ಶನ ವೇದಿಕೆ',
    badge: '✦ ವೃತ್ತಿ ವರದಿ ✦',
    generatedOn: 'ತಯಾರಿಸಿದ ದಿನಾಂಕ: {{date}}',
    confidenceScore: 'ಆತ್ಮವಿಶ್ವಾಸ ಅಂಕ',
    sections: {
      studentSummary: '👤 ವಿದ್ಯಾರ್ಥಿ ಪ್ರೊಫೈಲ್ ಸಾರಾಂಶ',
      interestAnalysis: '🎯 ಆಸಕ್ತಿಗಳ ವಿಶ್ಲೇಷಣೆ',
      aptitudeAnalysis: '🧠 ಸಾಮರ್ಥ್ಯ ವಿಶ್ಲೇಷಣೆ',
      personalityInsights: '🌟 ವ್ಯಕ್ತಿತ್ವ ಒಳನೋಟ',
      scores: '📊 ಕೌಶಲ್ಯ ಮತ್ತು ಸಾಮರ್ಥ್ಯ ಅಂಕಗಳು',
      recommendedStream: '🎓 ಶಿಫಾರಸು ಮಾಡಿದ ಸ್ಟ್ರೀಮ್',
      topCareers: '🚀 शीर्ष ವೃತ್ತಿ ಶಿಫಾರಸುಗಳು',
      higherEducation: '🏫 ಉನ್ನತ ಶಿಕ್ಷಣ ದಿಕ್ಕು',
      skillGaps: '⚡ ಸುಧಾರಿಸಬೇಕಾದ ಕೌಶಲ್ಯಗಳು',
      roadmap: '📅 ವೃತ್ತಿ ರೋಡ್‌ಮ್ಯಾಪ್',
      nextSteps: '✅ ಮುಂದಿನ ಹಂತಗಳು',
      parentGuidance: '👨‍👩‍👧 ಪೋಷಕರ ಮಾರ್ಗದರ್ಶನ',
      messageForYou: '💫 ನಿಮ್ಮಿಗಾಗಿ ಸಂದೇಶ',
    },
    labels: {
      type: 'ಪ್ರಕಾರ',
      learningStyle: 'ಕಲಿಕೆಯ ಶೈಲಿ',
      recommendedSubjects: 'ಶಿಫಾರಸು ಮಾಡಿದ ವಿಷಯಗಳು',
      path: 'ಪಥ',
      indiaScope: 'ಭಾರತದಲ್ಲಿ ಅವಕಾಶ',
      stream: 'ಸ್ಟ್ರೀಮ್',
      fitScore: 'ಫಿಟ್ ಅಂಕ',
    },
    roadmap: {
      oneYear: '1-ವರ್ಷದ ಕಾರ್ಯಯೋಜನೆ',
      threeYear: '3-ವರ್ಷದ ವೃತ್ತಿ ರೋಡ್‌ಮ್ಯಾಪ್',
      quarter: 'Q{{quarter}} (ತಿಂಗಳುಗಳು {{range}}): {{text}}',
      year: 'ವರ್ಷ {{year}}: {{text}}',
      goal: 'ಲಕ್ಷ್ಯ',
      action: 'ಕ್ರಿಯೆ',
      milestone: 'ಮೈಲ್ಸ್ಟೋನ್',
    },
    scoreLabels: {
      stem: 'STEM',
      creative: 'ಸೃಜನಾತ್ಮಕ',
      social: 'ಸಾಮಾಜಿಕ',
      logical: 'ತಾರ್ಕಿಕ',
      analytical: 'ವಿಶ್ಲೇಷಣಾತ್ಮಕ',
      leadership: 'ನಾಯಕತ್ವ',
      communication: 'ಸಂವಹನ',
      technical: 'ತಾಂತ್ರಿಕ',
      entrepreneurial: 'ಉದ್ಯಮಶೀಲ',
      research: 'ಸಂಶೋಧನೆ',
    },
  },
  ml: {
    title: 'CAD Gurukul – കരിയർ മാർഗനിർദ്ദേശ റിപ്പോർട്ട്',
    subtitle: 'ഭാരതീയ വിദ്യാർത്ഥികൾക്കുള്ള AI അധിഷ്ഠിത കരിയർ മാർഗനിർദ്ദേശ പ്ലാറ്റ്ഫോം',
    badge: '✦ കരിയർ റിപ്പോർട്ട് ✦',
    generatedOn: 'തയ്യാർ ചെയ്തത്: {{date}}',
    confidenceScore: 'ആത്മവിശ്വാസ സ്കോർ',
    sections: {
      studentSummary: '👤 വിദ്യാർത്ഥി പ്രൊഫൈൽ സംഗ്രഹം',
      interestAnalysis: '🎯 താൽപ്പര്യ വിശകലനം',
      aptitudeAnalysis: '🧠 കഴിവ് വിശകലനം',
      personalityInsights: '🌟 വ്യക്തിത്വ വിശകലനം',
      scores: '📊 കഴിവ് & കുശലത സ്കോറുകൾ',
      recommendedStream: '🎓 ശുപാർശ ചെയ്ത സ്‌ട്രീം',
      topCareers: '🚀 മുൻനിര കരിയർ ശുപാർശകൾ',
      higherEducation: '🏫 ഉയർന്ന വിദ്യാഭ്യാസ ദിശ',
      skillGaps: '⚡ മെച്ചപ്പെടുത്തേണ്ട കഴിവുകൾ',
      roadmap: '📅 കരിയർ റോഡ്മാപ്പ്',
      nextSteps: '✅ അടുത്ത നടപടികൾ',
      parentGuidance: '👨‍👩‍👧 മാതാപിതാക്കൾക്ക് മാർഗനിർദ്ദേശം',
      messageForYou: '💫 നിങ്ങള്ക്കായുള്ള സന്ദേശം',
    },
    labels: {
      type: 'തരം',
      learningStyle: 'പഠന ശൈലി',
      recommendedSubjects: 'ശുപാർശ ചെയ്ത വിഷയങ്ങൾ',
      path: 'പാത',
      indiaScope: 'ഇന്ത്യയിലെ അവസരം',
      stream: 'സ്‌ട്രീം',
      fitScore: 'ഫിറ്റ് സ്കോർ',
    },
    roadmap: {
      oneYear: '1-വർഷ പ്രവർത്തന പദ്ധതി',
      threeYear: '3-വർഷ കരിയർ റോഡ്മാപ്പ്',
      quarter: 'Q{{quarter}} (മാസങ്ങൾ {{range}}): {{text}}',
      year: 'വർഷം {{year}}: {{text}}',
      goal: 'ലക്ഷ്യം',
      action: 'പ്രവർത്തനം',
      milestone: 'മൈൽസ്റ്റോൺ',
    },
    scoreLabels: {
      stem: 'STEM',
      creative: 'സൃഷ്ടിപര',
      social: 'സാമൂഹിക',
      logical: 'താർക്കിക',
      analytical: 'വിശകലനാത്മക',
      leadership: 'നേതൃത്വം',
      communication: 'സംവേദനം',
      technical: 'സാങ്കേതിക',
      entrepreneurial: 'ഉദ്യമശീല',
      research: 'ഗവേഷണം',
    },
  },
  or: {
    title: 'CAD Gurukul – କେରିୟର୍ ଗାଇଡେନ୍ସ ରିପୋର୍ଟ',
    subtitle: 'ଭାରତୀୟ ଛାତ୍ରଛାତ୍ରୀମାନଙ୍କ ପାଇଁ AI ଭିତ୍ତିକ କେରିୟର୍ ଗାଇଡେନ୍ସ ପ୍ଲାଟଫର୍ମ',
    badge: '✦ କେରିୟର୍ ରିପୋର୍ଟ ✦',
    generatedOn: 'ତିଆରି ତାରିଖ: {{date}}',
    confidenceScore: 'ଆତ୍ମବିଶ୍ୱାସ ସ୍କୋର',
    sections: {
      studentSummary: '👤 ଛାତ୍ର ପ୍ରୋଫାଇଲ୍ ସାରାଂଶ',
      interestAnalysis: '🎯 ରୁଚି ବିଶ୍ଳେଷଣ',
      aptitudeAnalysis: '🧠 କ୍ଷମତା ବିଶ୍ଳେଷଣ',
      personalityInsights: '🌟 ବ୍ୟକ୍ତିତ୍ୱ ଅନ୍ତର୍ଦୃଷ୍ଟି',
      scores: '📊 କୌଶଳ ଓ କ୍ଷମତା ସ୍କୋର',
      recommendedStream: '🎓 ସୁପାରିଶକୃତ ଷ୍ଟ୍ରିମ୍',
      topCareers: '🚀 ଶ୍ରେଷ୍ଠ କେରିୟର୍ ସୁପାରିଶ',
      higherEducation: '🏫 ଉଚ୍ଚ ଶିକ୍ଷା ଦିଗ',
      skillGaps: '⚡ ଉନ୍ନତ କରିବାକୁ କୌଶଳ',
      roadmap: '📅 କେରିୟର୍ ରୋଡମ୍ୟାପ୍',
      nextSteps: '✅ ପରବର୍ତ୍ତୀ ପଦକ୍ଷେପ',
      parentGuidance: '👨‍👩‍👧 ଅଭିଭାବକ ମାର୍ଗଦର୍ଶନ',
      messageForYou: '💫 ଆପଣଙ୍କ ପାଇଁ ସନ୍ଦେଶ',
    },
    labels: {
      type: 'ପ୍ରକାର',
      learningStyle: 'ଶିକ୍ଷା ଶୈଳୀ',
      recommendedSubjects: 'ସୁପାରିଶ ହୋଇଥିବା ବିଷୟ',
      path: 'ପଥ',
      indiaScope: 'ଭାରତରେ ସୁଯୋଗ',
      stream: 'ଷ୍ଟ୍ରିମ୍',
      fitScore: 'ଫିଟ୍ ସ୍କୋର',
    },
    roadmap: {
      oneYear: '1-ବର୍ଷ କାର୍ଯ୍ୟ ଯୋଜନା',
      threeYear: '3-ବର୍ଷ କେରିୟର୍ ରୋଡମ୍ୟାପ୍',
      quarter: 'Q{{quarter}} (ମାସ {{range}}): {{text}}',
      year: 'ବର୍ଷ {{year}}: {{text}}',
      goal: 'ଲକ୍ଷ୍ୟ',
      action: 'କାର୍ଯ୍ୟ',
      milestone: 'ମାଇଲ୍‌ସ୍ଟୋନ୍',
    },
    scoreLabels: {
      stem: 'STEM',
      creative: 'ସୃଜନଶୀଳ',
      social: 'ସାମାଜିକ',
      logical: 'ତର୍କସଂଗତ',
      analytical: 'ବିଶ୍ଳେଷଣାତ୍ମକ',
      leadership: 'ନେତୃତ୍ୱ',
      communication: 'ଯୋଗାଯୋଗ',
      technical: 'ତେକନିକାଲ୍',
      entrepreneurial: 'ଉଦ୍ୟମଶୀଳ',
      research: 'ଗବେଷଣା',
    },
  },
  pa: {
    title: 'CAD Gurukul – ਕਰੀਅਰ ਗਾਈਡੈਂਸ ਰਿਪੋਰਟ',
    subtitle: 'ਭਾਰਤੀ ਵਿਦਿਆਰਥੀਆਂ ਲਈ AI ਆਧਾਰਤ ਕਰੀਅਰ ਗਾਈਡੈਂਸ ਪਲੇਟਫਾਰਮ',
    badge: '✦ ਕਰੀਅਰ ਰਿਪੋਰਟ ✦',
    generatedOn: 'ਤਿਆਰ ਕੀਤਾ: {{date}}',
    confidenceScore: 'ਆਤਮਵਿਸ਼ਵਾਸ ਸਕੋਰ',
    sections: {
      studentSummary: '👤 ਵਿਦਿਆਰਥੀ ਪ੍ਰੋਫ਼ਾਈਲ ਸਾਰ',
      interestAnalysis: '🎯 ਰੁਚੀ ਵਿਸ਼ਲੇਸ਼ਣ',
      aptitudeAnalysis: '🧠 ਯੋਗਤਾ ਵਿਸ਼ਲੇਸ਼ਣ',
      personalityInsights: '🌟 ਵਿਅਕਤੀਤਵ ਝਲਕੀਆਂ',
      scores: '📊 ਕੌਸ਼ਲ ਅਤੇ ਯੋਗਤਾ ਸਕੋਰ',
      recommendedStream: '🎓 ਸਿਫਾਰਸ਼ੀ ਸਟਰੀਮ',
      topCareers: '🚀 ਸਰਵੋਤਮ ਕਰੀਅਰ ਸਿਫਾਰਸ਼ਾਂ',
      higherEducation: '🏫 ਉੱਚ ਸਿੱਖਿਆ ਦਿਸ਼ਾ',
      skillGaps: '⚡ ਸੁਧਾਰ ਯੋਗ ਕੌਸ਼ਲ',
      roadmap: '📅 ਕਰੀਅਰ ਰੋਡਮੈਪ',
      nextSteps: '✅ ਅਗਲੇ ਕਦਮ',
      parentGuidance: '👨‍👩‍👧 ਮਾਪਿਆਂ ਲਈ ਮਾਰਗਦਰਸ਼ਨ',
      messageForYou: '💫 ਤੁਹਾਡੇ ਲਈ ਸੁਨੇਹਾ',
    },
    labels: {
      type: 'ਕਿਸਮ',
      learningStyle: 'ਸਿੱਖਣ ਦੀ ਸ਼ੈਲੀ',
      recommendedSubjects: 'ਸਿਫਾਰਸ਼ੀ ਵਿਸ਼ੇ',
      path: 'ਰਸਤਾ',
      indiaScope: 'ਭਾਰਤ ਵਿੱਚ ਮੌਕੇ',
      stream: 'ਸਟਰੀਮ',
      fitScore: 'ਫਿਟ ਸਕੋਰ',
    },
    roadmap: {
      oneYear: '1-ਸਾਲਾ ਕਾਰਵਾਈ ਯੋਜਨਾ',
      threeYear: '3-ਸਾਲਾ ਕਰੀਅਰ ਰੋਡਮੈਪ',
      quarter: 'Q{{quarter}} (ਮਹੀਨੇ {{range}}): {{text}}',
      year: 'ਸਾਲ {{year}}: {{text}}',
      goal: 'ਲਕਸ਼',
      action: 'ਕਾਰਵਾਈ',
      milestone: 'ਮਾਈਲਸਟੋਨ',
    },
    scoreLabels: {
      stem: 'STEM',
      creative: 'ਸਰਜਨਾਤਮਕ',
      social: 'ਸਮਾਜਿਕ',
      logical: 'ਤਰਕਸ਼ੀਲ',
      analytical: 'ਵਿਸ਼ਲੇਸ਼ਣਾਤਮਕ',
      leadership: 'ਨੇਤ੍ਰਿਤਵ',
      communication: 'ਸੰਚਾਰ',
      technical: 'ਤਕਨੀਕੀ',
      entrepreneurial: 'ਉਦਯੋਗਪਤੀ',
      research: 'ਖੋਜ',
    },
  },
};

const getNestedValue = (source, path) => path.split('.').reduce((acc, key) => (acc && acc[key] !== undefined ? acc[key] : undefined), source);

const interpolate = (template, values = {}) =>
  String(template || '').replace(/{{\s*(\w+)\s*}}/g, (_, key) => (values[key] !== undefined ? values[key] : ''));

const resolveLanguageCode = (profile) => {
  const raw = String(profile?.languagePreference || '').trim().toLowerCase();
  return LANGUAGE_CODE_MAP[raw] || 'en';
};

const buildTranslator = (langCode) => {
  const translations = REPORT_TRANSLATIONS[langCode] || REPORT_TRANSLATIONS.en;
  const fallback = REPORT_TRANSLATIONS.en;
  return (path, vars) => {
    const template = getNestedValue(translations, path) || getNestedValue(fallback, path) || '';
    return interpolate(template, vars);
  };
};

const buildReportTranslator = (profile) => buildTranslator(resolveLanguageCode(profile));

/**
 * Resolve the Chromium/Chrome executable path.
 *
 * Priority:
 *  1. PUPPETEER_EXECUTABLE_PATH env var (set in Dockerfile ENV for Alpine containers)
 *  2. Probe common system paths (Alpine apk chromium, Debian apt chromium)
 *  3. Let Puppeteer use its own bundled Chromium (local dev without skip flag)
 */
const resolveChromiumPath = () => {
  const envPath = process.env.PUPPETEER_EXECUTABLE_PATH;
  if (envPath) {
    // Only trust the env var if the file actually exists — guards against bad .env values
    try {
      if (fs.existsSync(envPath)) return envPath;
      logger.warn('[PDFGenerator] PUPPETEER_EXECUTABLE_PATH set but not found, falling back to candidates', { envPath });
    } catch (_) { /* ignore */ }
  }
  const candidates = [
    '/usr/bin/chromium-browser',    // Alpine: apk add chromium (used in Dockerfile)
    '/usr/bin/chromium',            // Some Alpine versions
    '/usr/bin/google-chrome-stable',
    '/usr/bin/google-chrome',
  ];
  for (const p of candidates) {
    try { if (fs.existsSync(p)) return p; } catch (_) { /* ignore */ }
  }
  return undefined; // fall back to Puppeteer bundled binary (local dev)
};

/**
 * Generates a PDF from the career report data.
 * Returns a Buffer containing the PDF bytes.
 */
const generatePdf = async (reportData, profile) => {
  logger.info('[PDFGenerator] Generating PDF report', { userId: profile.userId });

  const html = buildReportHtml(reportData, profile);
  const executablePath = resolveChromiumPath();

  logger.info('[PDFGenerator] Using Chromium', { executablePath: executablePath || 'puppeteer-bundled' });

  const browser = await puppeteer.launch({
    headless: true,
    executablePath,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  });

  try {
    const page = await browser.newPage();
    page.setDefaultNavigationTimeout(60000);
    // Use domcontentloaded — our HTML is fully self-contained (no external resources)
    await page.setContent(html, { waitUntil: 'domcontentloaded' });

    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '20mm', bottom: '20mm', left: '15mm', right: '15mm' },
    });

    logger.info('[PDFGenerator] PDF generated successfully');
    return Buffer.from(pdfBuffer); // ensure Buffer for res.end() + Content-Length
  } finally {
    await browser.close();
  }
};

/**
 * Build HTML template for the career report
 */
const buildReportHtml = (report, profile) => {
  const langCode = resolveLanguageCode(profile);
  const t = buildTranslator(langCode);
  const locale = LANGUAGE_LOCALE_MAP[langCode] || LANGUAGE_LOCALE_MAP.en;
  const isRtl = langCode === 'ur';
  const topCareers = (report.topCareers || [])
    .map((career) => {
      if (typeof career === 'string') {
        return `<li class="career-item"><strong>${career}</strong></li>`;
      }
      return `
        <li class="career-item">
          <div class="career-header">
            <strong>${career.name || career.title || ''}</strong>
            <span class="fit-score">${career.fitScore != null ? `${t('labels.fitScore')}: ${career.fitScore}%` : ''}</span>
          </div>
          <p>${career.description || career.reason || ''}</p>
          ${career.coursePath ? `<p><em>${t('labels.path')}: ${career.coursePath}</em></p>` : ''}
          ${career.indiaScope ? `<p><em>${t('labels.indiaScope')}: ${career.indiaScope}</em></p>` : ''}
          ${career.stream ? `<p><em>${t('labels.stream')}: ${career.stream}</em></p>` : ''}
        </li>`;
    })
    .join('');

  // Build roadmap HTML from the normalized roadmaps array (handles all report formats)
  const roadmapsArray = Array.isArray(report.roadmaps) && report.roadmaps.length > 0
    ? report.roadmaps
    : report.oneYearRoadmap
      ? [
          { career: t('roadmap.oneYear'), steps: [
              t('roadmap.quarter', { quarter: 1, range: '1-3', text: report.oneYearRoadmap.quarter1 || '' }),
              t('roadmap.quarter', { quarter: 2, range: '4-6', text: report.oneYearRoadmap.quarter2 || '' }),
              t('roadmap.quarter', { quarter: 3, range: '7-9', text: report.oneYearRoadmap.quarter3 || '' }),
              t('roadmap.quarter', { quarter: 4, range: '10-12', text: report.oneYearRoadmap.quarter4 || '' }),
          ]},
          { career: t('roadmap.threeYear'), steps: [
              t('roadmap.year', { year: 1, text: report.threeYearRoadmap?.year1 || '' }),
              t('roadmap.year', { year: 2, text: report.threeYearRoadmap?.year2 || '' }),
              t('roadmap.year', { year: 3, text: report.threeYearRoadmap?.year3 || '' }),
          ]},
        ]
      : [];

  const roadmapHtml = roadmapsArray.length > 0
    ? `<div class="section"><h2>${t('sections.roadmap')}</h2>${roadmapsArray.map((rm) => `
      <div style="margin-bottom:14px">
        <strong style="color:#0f3460">${rm.career || ''}</strong>
        <ul style="margin-top:6px">${(rm.steps || []).map((s) => `<li>${s}</li>`).join('')}</ul>
      </div>`).join('')}</div>`
    : '';

  return `<!DOCTYPE html>
<html lang="${langCode}" dir="${isRtl ? 'rtl' : 'ltr'}">
<head>
  <meta charset="UTF-8" />
  <title>${t('title')}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Segoe UI', Arial, sans-serif; color: #1a1a2e; background: #fff; font-size: 13px; line-height: 1.6; }
    .cover { background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%); color: #fff; padding: 60px 40px; text-align: center; }
    .cover h1 { font-size: 32px; color: #e94560; margin-bottom: 8px; }
    .cover .subtitle { font-size: 16px; color: #a8b2d8; margin-bottom: 30px; }
    .cover .student-name { font-size: 28px; font-weight: 700; margin-bottom: 8px; }
    .cover .student-meta { font-size: 14px; color: #ccd6f6; }
    .cover .report-badge { display: inline-block; background: #e94560; color: #fff; padding: 6px 20px; border-radius: 20px; font-size: 12px; font-weight: 700; margin-top: 20px; letter-spacing: 2px; }
    .content { padding: 30px 40px; }
    .section { margin-bottom: 28px; border-left: 4px solid #e94560; padding-left: 16px; }
    .section h2 { font-size: 18px; color: #0f3460; margin-bottom: 10px; }
    .section p { margin-bottom: 8px; color: #333; }
    .score-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-top: 12px; }
    .score-card { background: #f0f4ff; border-radius: 8px; padding: 12px; text-align: center; }
    .score-card .label { font-size: 11px; color: #666; text-transform: uppercase; letter-spacing: 0.5px; }
    .score-card .value { font-size: 22px; font-weight: 700; color: #0f3460; }
    .highlight-box { background: #fff8f0; border: 1px solid #ffd0a0; border-radius: 8px; padding: 16px; margin-bottom: 12px; }
    .career-list { list-style: none; }
    .career-item { background: #f8f9ff; border: 1px solid #e0e7ff; border-radius: 8px; padding: 14px; margin-bottom: 10px; }
    .career-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px; }
    .fit-score { background: #0f3460; color: #fff; padding: 2px 10px; border-radius: 12px; font-size: 11px; }
    ul.action-list li { margin-bottom: 6px; padding-left: 8px; }
    .parent-section { background: #f0fff4; border: 1px solid #b7dfc3; border-radius: 8px; padding: 16px; }
    .footer { background: #1a1a2e; color: #a8b2d8; text-align: center; padding: 20px; font-size: 11px; }
    .confidence-badge { display: inline-block; background: #22c55e; color: #fff; padding: 4px 16px; border-radius: 20px; font-weight: 700; font-size: 14px; }
    .page-break { page-break-before: always; }
    .tag { display: inline-block; background: #e0e7ff; color: #4338ca; padding: 2px 10px; border-radius: 10px; font-size: 11px; margin: 2px; }
  </style>
</head>
<body>

<!-- Cover Page -->
<div class="cover">
  <h1>CAD Gurukul</h1>
  <p class="subtitle">${t('subtitle')}</p>
  <div class="student-name">${profile.fullName}</div>
  <div class="student-meta">
    ${profile.classStandard?.replace('_', ' ') || ''} &bull; ${profile.board || ''} &bull; ${profile.city || ''}, ${profile.state || ''}
  </div>
  <div class="report-badge">${t('badge')}</div>
  <p style="margin-top:20px; font-size:12px; color:#8892b0;">${t('generatedOn', { date: new Date().toLocaleDateString(locale, { day: 'numeric', month: 'long', year: 'numeric' }) })}</p>
  <div style="margin-top:16px;">
    ${t('confidenceScore')}: <span class="confidence-badge">${report.confidenceScore || 80}%</span>
  </div>
</div>

<div class="content">

  <!-- Student Summary -->
  <div class="section">
    <h2>${t('sections.studentSummary')}</h2>
    <p>${report.studentSummary || ''}</p>
  </div>

  <!-- Interest Analysis -->
  <div class="section">
    <h2>${t('sections.interestAnalysis')}</h2>
    <p>${report.interestAnalysis || ''}</p>
  </div>

  <!-- Aptitude Analysis -->
  ${report.aptitudeAnalysis ? `<div class="section"><h2>${t('sections.aptitudeAnalysis')}</h2><p>${report.aptitudeAnalysis}</p></div>` : ''}

  <!-- Personality Insights -->
  ${report.personalityInsights ? `<div class="section"><h2>${t('sections.personalityInsights')}</h2><p>${report.personalityInsights}</p><p><strong>${t('labels.type')}:</strong> ${report.personalityType || ''} &bull; <strong>${t('labels.learningStyle')}:</strong> ${report.learningStyle || ''}</p></div>` : ''}

  <!-- Scores -->
  ${report.scores ? `
  <div class="section">
    <h2>${t('sections.scores')}</h2>
    <div class="score-grid">
      ${Object.entries(report.scores).map(([k, v]) => `<div class="score-card"><div class="label">${t(`scoreLabels.${k}`) || k}</div><div class="value">${v}</div></div>`).join('')}
    </div>
  </div>` : ''}

  <!-- Recommended Stream -->
  <div class="section">
    <h2>${t('sections.recommendedStream')}</h2>
    <div class="highlight-box">
      <strong style="font-size:18px; color:#0f3460;">${report.recommendedStream || ''}</strong>
      <p style="margin-top:8px;">${report.streamReason || ''}</p>
    </div>
    ${report.recommendedSubjects?.length ? `
    <p><strong>${t('labels.recommendedSubjects')}:</strong></p>
    <div>${(report.recommendedSubjects || []).map((s) => `<span class="tag">${s}</span>`).join('')}</div>
    <p style="margin-top:8px;">${report.subjectReason || ''}</p>` : ''}
  </div>

  <div class="page-break"></div>

  <!-- Top Careers -->
  <div class="section">
    <h2>${t('sections.topCareers')}</h2>
    <ul class="career-list">${topCareers}</ul>
  </div>

  <!-- Higher Education -->
  ${report.higherEducationDirection ? `<div class="section"><h2>${t('sections.higherEducation')}</h2><p>${report.higherEducationDirection}</p></div>` : ''}

  <!-- Skill Gaps -->
  ${report.skillGaps?.length ? `
  <div class="section">
    <h2>${t('sections.skillGaps')}</h2>
    <div>${(report.skillGaps || []).map((s) => `<span class="tag">⚠ ${s}</span>`).join('')}</div>
    ${report.skillDevelopmentPlan ? `<p style="margin-top:10px;">${report.skillDevelopmentPlan}</p>` : ''}
  </div>` : ''}

  <!-- Roadmaps -->
  ${roadmapHtml}

  <!-- Action Steps -->
  ${report.actionableNextSteps?.length ? `
  <div class="section">
    <h2>${t('sections.nextSteps')}</h2>
    <ul class="action-list">
      ${(report.actionableNextSteps || []).map((s, i) => `<li>${i + 1}. ${s}</li>`).join('')}
    </ul>
  </div>` : ''}

  <!-- Parent Guidance -->
  ${report.parentGuidance ? `
  <div class="section">
    <h2>${t('sections.parentGuidance')}</h2>
    <div class="parent-section">${report.parentGuidance}</div>
  </div>` : ''}

  <!-- Motivational Message -->
  ${report.motivationalMessage ? `
  <div class="section">
    <h2>${t('sections.messageForYou')}</h2>
    <blockquote style="border-left:4px solid #e94560; padding-left:16px; font-style:italic; color:#444;">${report.motivationalMessage}</blockquote>
  </div>` : ''}

</div>

<div class="footer">
  <p>CAD Gurukul | AI Career Guidance for Indian Students</p>
  <p>This report is generated by AI and should be used as a guidance tool alongside professional counselling.</p>
  <p>© ${new Date().getFullYear()} CAD Gurukul. All rights reserved.</p>
</div>

</body>
</html>`;
};

module.exports = { generatePdf, buildReportTranslator };
