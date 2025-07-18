import express from "express"
import cors from "cors";
import { getAllUsers, login, register } from "./Controllers/User_Controller.js";


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






export default app