const { Router } = require("express");
const { isAuthenticated } = require("../middlewares/isAuthenticated");
const { ScrapMaterial } = require("../controllers/Scrap.controller");
const { upload } = require("../utils/upload");

const routes = Router();
const scrapController = new ScrapMaterial();

routes
  .route("/create")
  .post(isAuthenticated, scrapController.createScrapMaterial);
routes.route("/get").get(isAuthenticated, scrapController.getScrapMaterial);
routes
  .route("/delete/:id")
  .delete(isAuthenticated, scrapController.deleteScrapMaterial);
routes
  .route("/update/:id")
  .put(isAuthenticated, scrapController.updateScrapMaterial);
routes
  .route("/filter")
  .get(isAuthenticated, scrapController.FilterScrapMaterial);
routes
  .route("/bulk-upload")
  .post(
    isAuthenticated,
    upload.single("excel"),
    scrapController.BulkCreateScrap
  );
routes.route("/get/:id").get(isAuthenticated, scrapController.FindWithId);

module.exports = { ScrapRoutes: routes };
