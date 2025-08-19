import express from "express"
import cors from "cors";
import { deleteUser, getAllUsers, getCurrentUserProfile, login, register, updateUser } from "./Controllers/User_Controller.js";
import { addFavoriteService, getFavoriteServices, removeFavoriteService } from "./Controllers/FavService_Controller.js";
import { createService, deleteService, getServiceById, getUserServices, searchServices, searchServicesNearby, updateService } from "./Controllers/services_controllers/index.js";


//servidor
const app = express()

app.use(cors());

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

//service endpoints
app.post("/service/post", createService)
app.get("/service/get/:id", getServiceById)
app.get("/service/user", getUserServices)
app.patch("/service/patch/:id", updateService)
app.delete("/service/delete/:id", deleteService)
app.get("/service/search", searchServices)
app.get("/service/nearby",searchServicesNearby)

//FavService endpoints
app.post("/fav/post/:id", addFavoriteService)
app.delete("/fav/delete/:id", removeFavoriteService)
app.get("/fav/get", getFavoriteServices)






export default app