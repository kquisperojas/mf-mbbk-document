import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-vision',
  imports: [RouterLink],
  templateUrl: './vision.html'
})
export class VisionPage {}

@Component({ selector: 'app-ficha-iniciativa', templateUrl: './ficha-iniciativa.html' })
export class FichaIniciativaPage {}

export { FichaMsPage } from './ficha-ms';
