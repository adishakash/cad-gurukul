'use strict';

jest.mock('../../config/database', () => ({
  user: {
    findUnique: jest.fn(),
    create: jest.fn(),
  },
  emailVerificationToken: {
    findFirst: jest.fn(),
    deleteMany: jest.fn(),
    create: jest.fn(),
  },
}));

jest.mock('bcryptjs', () => ({
  hash: jest.fn(),
  compare: jest.fn(),
}));

jest.mock('jsonwebtoken', () => ({
  sign: jest.fn(),
}));

jest.mock('uuid', () => ({
  v4: jest.fn(),
}));

jest.mock('../../utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

jest.mock('../../services/email/emailService', () => ({
  sendWelcomeEmail: jest.fn(),
  sendVerificationEmail: jest.fn().mockResolvedValue({ messageId: 'mock-email-id' }),
}));

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const prisma = require('../../config/database');
const { sendVerificationEmail } = require('../../services/email/emailService');
const { register } = require('../auth.controller');

describe('auth.controller register', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    bcrypt.hash.mockResolvedValue('hashed-password');
    jwt.sign.mockReturnValue('access-token');
    uuidv4.mockReturnValue('refresh-token');
    prisma.user.findUnique.mockResolvedValue(null);
    prisma.user.create.mockResolvedValue({
      id: 'user-1',
      email: 'student@example.com',
      role: 'STUDENT',
      createdAt: new Date('2026-04-13T00:00:00.000Z'),
    });
    prisma.emailVerificationToken.findFirst.mockResolvedValue(null);
    prisma.emailVerificationToken.deleteMany.mockResolvedValue({ count: 0 });
    prisma.emailVerificationToken.create.mockResolvedValue({ id: 'verify-token-1' });
  });

  it('creates a student profile with empty required arrays', async () => {
    const req = {
      body: {
        email: 'student@example.com',
        password: 'Password1',
        fullName: 'Student Example',
        role: 'STUDENT',
      },
    };

    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };

    await register(req, res);

    expect(prisma.user.create).toHaveBeenCalledWith({
      data: {
        email: 'student@example.com',
        passwordHash: 'hashed-password',
        role: 'STUDENT',
        isEmailVerified: false,
        studentProfile: {
          create: {
            fullName: 'Student Example',
            preferredSubjects: [],
            hobbies: [],
            interests: [],
            locationPreference: [],
          },
        },
      },
      select: { id: true, email: true, role: true, createdAt: true },
    });
    expect(prisma.emailVerificationToken.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ userId: 'user-1' }),
    });
    expect(sendVerificationEmail).toHaveBeenCalledWith({
      to: 'student@example.com',
      name: 'Student Example',
      token: expect.any(String),
    });
    expect(res.status).toHaveBeenCalledWith(201);
  });
});
