import { Request, Response } from 'express';
import RenderService from './render-service';

class RenderController {
  private renderService: RenderService;

  constructor(renderService: RenderService) {
    this.renderService = renderService;
  }

  async startRender(req: Request, res: Response): Promise<void> {
    try {
        const {videoResult, userId, audioLink, subtitlesLink, audioKey, subtitlesKey} = req.body;
        
        const video = await this.renderService.startRender(videoResult, userId, audioLink, subtitlesLink, audioKey, subtitlesKey);

      res.status(200).json(video);
    } catch (error) {
      res.status(500).json({ message: "Internal server error"});
    }
  }

  async getText(req: Request, res: Response): Promise<void> {
    try {
        const {title, description} = req.body;

        const fullText = await this.renderService.getText(title, description);

      res.status(200).json(fullText);
    } catch (error) {
      res.status(500).json({ message: "Internal server error"});
    }
  }

  async getAudio(req: Request, res: Response): Promise<void> {
    try {
        const {text, userId} = req.body;

        const audioLink = await this.renderService.getAudio(text, userId);

      res.status(200).json(audioLink);
    } catch (error) {
      res.status(500).json({ message: "Internal server error"});
    }
  }

  async getSubtitles(req: Request, res: Response): Promise<void> {
    try {
        const {audioLocal, text, userId} = req.body;
        
        const subtitlesLink = await this.renderService.getSubtitles(audioLocal, text, userId);

      res.status(200).json(subtitlesLink);
    } catch (error) {
      res.status(500).json({ message: "Internal server error"});
    }
  }

  async getVideos(req: Request, res: Response): Promise<void>{
    try{
      const {text, duration, userId} = req.body;

      
      
        
      const videos = await this.renderService.getVideos(text, duration, userId);
      
      res.status(200).json(videos);
    } catch{
      res.status(500).json({ message: "Internal server error"});
    }
  }

}

export default RenderController;