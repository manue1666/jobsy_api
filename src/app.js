import express from "express"
import cors from "cors";
import { createService, deleteService, getServiceById, getUserServices, searchServices, searchServicesNearby, updateService } from "./Controllers/services_controllers/index.js";
import { handleStripeWebhook } from "./utils/stripeWebHook.js";
import { boostService } from "./Controllers/services_controllers/boost_service.js";
import { startAllCronJobs } from "./utils/cron.js";
import { deleteUser, getAllUsers, getCurrentUserProfile, getUserData, login, register, updateUser } from "./Controllers/user_controllers/index.js";
import { addFavoriteService, getFavoriteServices, removeFavoriteService } from "./Controllers/fav_services_controller/index.js";
import { createPremiumSetupIntent, premiumUser } from "./Controllers/user_controllers/premium_user.js";
import { cancelPremium } from "./Controllers/user_controllers/cancel_premium.js";
import { statusPremium } from "./Controllers/user_controllers/status_premium.js";
import { addComment, deleteComment, getCommentsByService } from "./Controllers/comments_controller/index.js";
import { sendEmail } from "./Controllers/emailController/email.js";
import { updatePasswordUser } from "./Controllers/user_controllers/update_password_user.js";
import { recoverPassword } from "./Controllers/emailController/recover_password.js";
import { searchServicesWeb } from "./Controllers/services_controllers/search_services_web.js";


//servidor
const app = express()

app.use(cors());
//HOOK DE STRIPE
app.post(
  '/webhook',
  express.raw({ type: 'application/json' }), // Raw solo para webhook
  handleStripeWebhook
);
app.use(express.json())
app.use(express.urlencoded({extended:true}))

app.get("/",(_req,res)=>{
    res.send("servidor js corriendo")
})


//ENDPOINTS

//user endpoints
//app.get("/user/get", getAllUsers)
app.post("/user/regist",register)
app.post("/user/login", login)
app.patch("/user/patch/:id", updateUser)
app.delete("/user/delete/:id", deleteUser)
app.get("/user/me", getCurrentUserProfile)
app.post("/user/premium", premiumUser)
app.post("/user/premium/setup-intent", createPremiumSetupIntent);
app.post("/user/premium/cancel", cancelPremium);
app.get("/user/premium/status", statusPremium);
app.patch("/user/password", updatePasswordUser);
app.get("/user/data/:id", getUserData);

//service endpoints
app.post("/service/post", createService)
app.get("/service/get/:id", getServiceById)
app.get("/service/user", getUserServices)
app.patch("/service/patch/:id", updateService)
app.delete("/service/delete/:id", deleteService)
app.get("/service/search", searchServices)
app.get("/service/nearby",searchServicesNearby)
app.post('/service/boost/:id',boostService);

app.get("/service/web", searchServicesWeb); //para mostrar servicios en web

//FavService endpoints
app.post("/fav/post/:id", addFavoriteService)
app.delete("/fav/delete/:id", removeFavoriteService)
app.get("/fav/get", getFavoriteServices)

//Comment endpoints
app.post("/comment/post/:id", addComment)
app.get("/comments/:id", getCommentsByService);
app.delete("/comment/delete/:id", deleteComment);

//Email endpoint
app.post("/email/post", sendEmail)
app.post("/email/recover", recoverPassword);

startAllCronJobs();






export default app