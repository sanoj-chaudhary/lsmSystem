import express from 'express'
const router = express.Router()
import { authrizedRoles, isAuthenticated } from "./../middleware/auth"
import { registrationUser, activeUser, loginUser, logoutUser, updateAccessToken,getUserInfo } from '../controllers/userController'

router.post('/register', registrationUser)
router.post('/active-user', activeUser)
router.post('/login-user', loginUser)
router.get('/logout-user',isAuthenticated, logoutUser)
router.get('/refresh-token', updateAccessToken)
router.get('/me',isAuthenticated, getUserInfo)

export default router