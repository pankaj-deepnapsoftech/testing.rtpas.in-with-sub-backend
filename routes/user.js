const express = require("express");

const {

  create,

  update,

  remove,

  details,

  loginWithToken,

  loginWithPassword,

  resetPasswordRequest,

  resetPassword,

  verifyUser,

  resendOtp,

  all,  

  employeeDetails,

  updateProfile, 

  

} = require("../controllers/user");

const { verifyOTP } = require("../middlewares/verifyOTP");

const { isUserVerified } = require("../middlewares/isVerified");

const { isAuthenticated } = require("../middlewares/isAuthenticated");

const { isSuper } = require("../middlewares/isSuper");

const router = express.Router();



router.post("/", create);
router.get("/all", isAuthenticated, all);

// router.get("/all", isAuthenticated, isSuper, all);

router.post("/verify", verifyOTP, verifyUser);

router.post("/resend-otp", resendOtp);

router.patch("/user/profile", isAuthenticated,  updateProfile);

router

  .route("/login")

  .get(isUserVerified, loginWithToken)

  .post(isUserVerified, loginWithPassword);

router

  .route("/user")

  .get(isAuthenticated, details)

  .put(isAuthenticated, isSuper, update)

  .delete(isAuthenticated, isSuper, remove);

router.post("/reset-password-request", isUserVerified, resetPasswordRequest);

router.post("/reset-password", isUserVerified, verifyOTP, resetPassword);

router.get('/user/:_id', isAuthenticated, employeeDetails);





module.exports = router;


router.post("/", create);
router.get("/all", isAuthenticated, all);

// router.get("/all", isAuthenticated, isSuper, all);

router.post("/verify", verifyOTP, verifyUser);

router.post("/resend-otp", resendOtp);

router.patch("/user/profile", isAuthenticated,  updateProfile);

router

  .route("/login")

  .get(isUserVerified, loginWithToken)

  .post(isUserVerified, loginWithPassword);

router

  .route("/user")

  .get(isAuthenticated, details)

  .put(isAuthenticated, isSuper, update)

  .delete(isAuthenticated, isSuper, remove);

router.post("/reset-password-request", isUserVerified, resetPasswordRequest);

router.post("/reset-password", isUserVerified, verifyOTP, resetPassword);

router.get('/user/:_id', isAuthenticated, employeeDetails);





module.exports = router;


