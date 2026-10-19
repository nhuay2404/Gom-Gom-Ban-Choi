// Số đo thân mèo (data/tuning.mjs CAT_BODY) + hàm toán nhỏ dùng chung cho khung và não mèo. Sang Unity: CatMath (static).
import { CAT_BODY, CAT_MOTION } from '../../data/tuning.mjs';

export const { W, H, D, LEG } = CAT_BODY, ROOM = CAT_MOTION.ROOM_LIMIT, TAU = Math.PI * 2;

export const rand = (a, b) => a + Math.random() * (b - a);

export const chance = p => Math.random() < p;

export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export const angDiff = (a, b) => ((((b - a) % TAU) + TAU + Math.PI) % TAU) - Math.PI;

export const damp = (value, target, rate, dt) => value + (target - value) * (1 - Math.exp(-rate * dt));
