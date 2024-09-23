
import { Router } from 'express';
import RenderService from './render-service';
import RenderController from './render-controller';


const renderRouter = Router();
const renderService = new RenderService();
const renderController = new RenderController(renderService);

renderRouter.post('/render', async (req, res) => renderController.startRender(req, res));
renderRouter.post('/getText', async (req, res) => renderController.getText(req, res));
renderRouter.post('/getAudio', async (req, res) => renderController.getAudio(req, res));
renderRouter.post('/getSubtitles', async (req, res) => renderController.getSubtitles(req, res));
renderRouter.post('/getVideos', async (req, res) => renderController.getVideos(req, res));


export default renderRouter;