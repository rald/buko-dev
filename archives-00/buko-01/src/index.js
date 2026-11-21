#!/usr/bin/env node
import { BukoReplController } from './controllers/BukoReplController.js';

const controller = new BukoReplController();
await controller.run();
