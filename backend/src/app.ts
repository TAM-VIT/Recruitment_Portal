import express from "express";
import cors from "cors";
import helmet from "helmet";
import { config } from "./config";
import { errorHandler, notFound } from "./middleware/error";
import publicRouter from "./routes/public";
import meRouter from "./routes/me";
import formRouter from "./routes/form";
import statusRouter from "./routes/status";
import slotsRouter from "./routes/slots";
import otpAuthRouter from "./routes/otpAuth";
import testToolsRouter from "./routes/testTools";

export const app = express();
app.set("trust proxy", 1); // behind one proxy on hosts like Render, so req.ip is the student's address

app.use(helmet());
app.use(cors({ origin: config.corsOrigin }));
app.use(express.json({ limit: "100kb" }));

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

app.use("/api/auth", otpAuthRouter);
app.use("/api", publicRouter);
app.use("/api", meRouter);
app.use("/api/form", formRouter);
app.use("/api/status", statusRouter);
app.use("/api/slots", slotsRouter);
if (config.testTools) app.use("/api/test", testToolsRouter);

app.use(notFound);
app.use(errorHandler);