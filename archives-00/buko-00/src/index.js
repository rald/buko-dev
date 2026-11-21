#!/usr/bin/env node
import { ReplController } from './controllers/ReplController.js';

const controller = new ReplController();
await controller.run();
