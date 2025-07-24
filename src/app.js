import express from "express"
import cors from "cors";
import { getAllUsers, login, register } from "./Controllers/User_Controller.js";
import { createService, deleteService, getServiceById, getUserServices, updateService } from "./Controllers/Service_Controller.js";


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

//service endpoints
app.post("/service/post", createService)
app.get("/service/get/:id", getServiceById)
app.get("/service/user", getUserServices)
app.patch("/service/patch/:id", updateService)
app.delete("/service/delete/:id", deleteService)






export default app