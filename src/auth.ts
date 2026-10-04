import crypto from "node:crypto";
import type { FastifyReply, FastifyRequest } from "fastify";
import { config } from "./config.js";

const cookieName = "asigurare_session";
const ttlMs = 1000 * 60 * 60 * 12;

function sign(value: string) {
  return crypto
    .createHmac("sha256", config.sessionSecret)
    .update(value)
    .digest("base64url");
}

function safeEqual(a: string, b: string) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

export function verifyPassword(password: string) {
  return safeEqual(password, config.appPassword);
}

export function createSessionCookie() {
  const payload = JSON.stringify({ createdAt: Date.now() });
  const value = Buffer.from(payload).toString("base64url");
  return `${value}.${sign(value)}`;
}

export function isAuthenticated(request: FastifyRequest) {
  const raw = request.cookies[cookieName];
  if (!raw) return false;
  const [value, signature] = raw.split(".");
  if (!value || !signature || sign(value) !== signature) return false;

  try {
    const payload = JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as {
      createdAt?: number;
    };
    return typeof payload.createdAt === "number" && Date.now() - payload.createdAt < ttlMs;
  } catch {
    return false;
  }
}

export function setSession(reply: FastifyReply) {
  reply.setCookie(cookieName, createSessionCookie(), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: Math.floor(ttlMs / 1000)
  });
}

export function clearSession(reply: FastifyReply) {
  reply.clearCookie(cookieName, { path: "/" });
}

export async function requireAuth(request: FastifyRequest, reply: FastifyReply) {
  if (!isAuthenticated(request)) {
    if (request.url.startsWith("/api/")) {
      return reply.status(401).send({ error: "Unauthorized" });
    }
    return reply.redirect("/login");
  }
}
