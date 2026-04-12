'use strict';
const prisma = require('../config/database');
const { successResponse, errorResponse } = require('../utils/helpers');
const logger = require('../utils/logger');

const normalizeProfileData = (profileData) => ({
  ...profileData,
  preferredSubjects: profileData.preferredSubjects ?? [],
  hobbies: profileData.hobbies ?? [],
  interests: profileData.interests ?? [],
  locationPreference: profileData.locationPreference ?? [],
});

/**
 * GET /students/me
 */
const getMyProfile = async (req, res) => {
  try {
    const profile = await prisma.studentProfile.findUnique({
      where: { userId: req.user.id },
      include: { parentDetail: true },
    });

    if (!profile) {
      return errorResponse(res, 'Student profile not found', 404, 'NOT_FOUND');
    }

    return successResponse(res, profile);
  } catch (err) {
    logger.error('[Student] getMyProfile error', { error: err.message, userId: req.user.id });
    throw err;
  }
};

/**
 * POST /students/me/onboarding
 * Creates/updates student profile and parent details
 */
const completeOnboarding = async (req, res) => {
  try {
    const {
      fullName, age, classStandard, schoolName, board,
      city, state, pinCode, mobileNumber, address,
      languagePreference, academicScores, preferredSubjects,
      hobbies, interests, careerAspirations,
      budgetPreference, locationPreference, specialNotes,
      // Parent fields
      parentName, parentContact, parentEmail, parentOccupation,
    } = req.body;

    const profileData = normalizeProfileData({
      fullName, age, classStandard, schoolName, board,
      city, state, pinCode, mobileNumber, address,
      languagePreference, academicScores, preferredSubjects,
      hobbies, interests, careerAspirations,
      budgetPreference, locationPreference, specialNotes,
      isOnboardingComplete: true,
    });

    // Upsert student profile
    const profile = await prisma.studentProfile.upsert({
      where: { userId: req.user.id },
      create: { userId: req.user.id, ...profileData },
      update: profileData,
    });

    // Upsert parent detail if provided
    if (parentName) {
      await prisma.parentDetail.upsert({
        where: { studentProfileId: profile.id },
        create: {
          userId: req.user.id,
          studentProfileId: profile.id,
          parentName,
          contactNumber: parentContact,
          email: parentEmail,
          occupation: parentOccupation,
        },
        update: {
          parentName,
          contactNumber: parentContact,
          email: parentEmail,
          occupation: parentOccupation,
        },
      });
    }

    logger.info('[Student] Onboarding completed', { userId: req.user.id });

    return successResponse(res, profile, 'Profile saved successfully');
  } catch (err) {
    logger.error('[Student] completeOnboarding error', { error: err.message, userId: req.user.id });
    throw err;
  }
};

/**
 * PUT /students/me
 */
const updateProfile = async (req, res) => {
  try {
    const existing = await prisma.studentProfile.findUnique({ where: { userId: req.user.id } });
    if (!existing) {
      return errorResponse(res, 'Complete onboarding first', 404, 'NOT_FOUND');
    }

    const updated = await prisma.studentProfile.update({
      where: { userId: req.user.id },
      data: req.body,
    });

    return successResponse(res, updated, 'Profile updated');
  } catch (err) {
    logger.error('[Student] updateProfile error', { error: err.message, userId: req.user.id });
    throw err;
  }
};

module.exports = { getMyProfile, completeOnboarding, updateProfile };
