import { Router } from 'express'
import renderRouter from './render/render-router'

const globalRouter = Router()

globalRouter.use('/create-video', renderRouter)

export default globalRouter
