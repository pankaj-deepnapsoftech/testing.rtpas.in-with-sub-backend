const { Router } = require("express");
const { isAuthenticated } = require("../middlewares/isAuthenticated");
const { ScrapMaterial } = require("../controllers/Scrap.controller");
const { upload } = require("../utils/upload");


const routes = Router();


routes.route("/create").post(ScrapMaterial.prototype.createScrapMaterial);
routes.route("/get").get(ScrapMaterial.prototype.getScrapMaterial);
routes.route("/delete/:id").delete(ScrapMaterial.prototype.deleteScrapMaterial);
routes.route("/update/:id").put(ScrapMaterial.prototype.updateScrapMaterial);
routes.route("/filter").get(ScrapMaterial.prototype.FilterScrapMaterial);
routes.route("/bulk-upload").post(upload.single("excel"), ScrapMaterial.prototype.BulkCreateScrap)
routes.route("/get/:id").post( ScrapMaterial.prototype.FindWithId)


module.exports = { ScrapRoutes: routes }