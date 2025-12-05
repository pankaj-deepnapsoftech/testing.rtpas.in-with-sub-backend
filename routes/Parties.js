const {Router} = require("express");
const { CreateParties, GetParties, UpdateParties, DeleteParties, bulkUploadHandler, GetUnapprovedParties } = require("../controllers/Parties");
const { Validater } = require("../validation/Validator");
const { PartiesValidation } = require("../validation/parties.validation");
const { isAuthenticated } = require("../middlewares/isAuthenticated");
const { upload } = require("../utils/upload"); // Import the upload utility

const routes  = Router();

routes.route("/create").post(isAuthenticated,Validater(PartiesValidation),CreateParties)
routes.route("/get").get(isAuthenticated,GetParties)
routes.route("/unapproved").get(isAuthenticated, GetUnapprovedParties)
routes.route("/delete/:id").delete(isAuthenticated, DeleteParties)
routes.route("/put/:id").put(isAuthenticated,UpdateParties)

// Add bulk upload route
routes.post("/bulk", isAuthenticated, upload.single('excel'), bulkUploadHandler);

module.exports = routes