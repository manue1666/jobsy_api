import express from "express"
import cors from "cors";
import { createService, deleteService, getServiceById, getUserServices, searchServices, searchServicesNearby, updateService } from "./Controllers/services_controllers/index.js";
import { handleStripeWebhook } from "./utils/stripeWebHook.js";
import { boostService } from "./Controllers/services_controllers/boost_service.js";
import { startAllCronJobs } from "./utils/cron.js";
import { deleteUser, getAllUsers, getCurrentUserProfile, login, register, updateUser } from "./Controllers/user_controllers/index.js";
import { addFavoriteService, getFavoriteServices, removeFavoriteService } from "./Controllers/fav_services_controller/index.js";
import { premiumUser } from "./Controllers/user_controllers/premium_user.js";


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
app.get("/user/get", getAllUsers)
app.post("/user/regist",register)
app.post("/user/login", login)
app.patch("/user/patch/:id", updateUser)
app.delete("/user/delete/:id", deleteUser)
app.get("/user/me", getCurrentUserProfile)
app.post("/user/premium", premiumUser)

//service endpoints
app.post("/service/post", createService)
app.get("/service/get/:id", getServiceById)
app.get("/service/user", getUserServices)
app.patch("/service/patch/:id", updateService)
app.delete("/service/delete/:id", deleteService)
app.get("/service/search", searchServices)
app.get("/service/nearby",searchServicesNearby)
app.post('/service/boost/:id',boostService);

//FavService endpoints
app.post("/fav/post/:id", addFavoriteService)
app.delete("/fav/delete/:id", removeFavoriteService)
app.get("/fav/get", getFavoriteServices)

startAllCronJobs();






export default app