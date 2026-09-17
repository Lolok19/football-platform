import { z } from 'zod';

export const registerSchema = z.object({
  email: z.string().email('Введите корректный email').max(255),
  password: z.string().min(6, 'Пароль должен быть не короче 6 символов').max(72),
  name: z.string().trim().min(2, 'Имя должно содержать минимум 2 символа').max(100)
});

export const loginSchema = z.object({
  email: z.string().email('Введите корректный email'),
  password: z.string().min(1, 'Введите пароль')
});

export const newsSchema = z.object({
  title: z.string().trim().min(5).max(180),
  excerpt: z.string().trim().min(10).max(1000),
  category: z.string().trim().min(2).max(50),
  imageUrl: z.string().url().optional().or(z.literal(''))
});
