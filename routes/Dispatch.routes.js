const { Router } = require("express");
const { isAuthenticated } = require("../middlewares/isAuthenticated");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const {
  CreateDispatch,
  DeleteDispatch,
  GetDispatch,
  UpdateDispatch,
  sendToDispatch,
  SendFromProduction,
  GetAllDispatches,
  UploadDeliveryProof,
  UploadInvoice,
  DownloadFile,
  Stats,
} = require("../controllers/dispatch.controller");

const uploadsDir = path.join(__dirname, "../uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "uploads/");
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(
      null,
      file.fieldname + "-" + uniqueSuffix + path.extname(file.originalname)
    );
  },
});

const fileFilter = (req, file, cb) => {
  if (
    file.mimetype.startsWith("image/") ||
    file.mimetype === "application/pdf"
  ) {
    cb(null, true);
  } else {
    cb(new Error("Only images and PDF files are allowed!"), false);
  }
};

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024,
  },
});

const routes = Router();
routes.route("/send-from-production").post(isAuthenticated, SendFromProduction);

routes.route("/create").post(isAuthenticated, CreateDispatch);
// routes.route("/createDispatch").post(isAuthenticated, CreateDispatch);
routes.route("/getAll").get(isAuthenticated, GetAllDispatches);
routes.route("/Delete-Dispatch/:id").post(isAuthenticated, DeleteDispatch);
routes.route("/get-Dispatch").get(isAuthenticated, GetDispatch);

routes.route("/update/:id").put(isAuthenticated, UpdateDispatch);

routes
  .route("/upload-delivery-proof/:id")
  .post(isAuthenticated, upload.single("delivery_proof"), UploadDeliveryProof);
routes
  .route("/upload-invoice/:id")
  .post(isAuthenticated, upload.single("invoice"), UploadInvoice);
routes.route("/download/:id/:type").get(isAuthenticated, DownloadFile);

routes.route("/dispatch-stats").get(isAuthenticated, Stats);
routes.route("/get_all_dispatch_with_id/:id").get()

module.exports = routes;
