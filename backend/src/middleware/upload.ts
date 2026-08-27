import multer from "multer";

const storage = multer.memoryStorage();

function fileFilter(_req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) {
  const name = file.originalname.toLowerCase();
  const allowed = name.endsWith(".csv") || file.mimetype === "text/csv" || file.mimetype === "application/csv";
  if (!allowed) {
    return cb(new Error("Only .csv files are allowed."));
  }
  cb(null, true);
}

export const upload = multer({
  storage,
  limits: { fileSize: 25 * 1024 * 1024, files: 50 },
  fileFilter,
});
