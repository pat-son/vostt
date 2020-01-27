import { Routes } from '@angular/router';
import { HomeComponent } from './core/components/home/home.component';
import { GameViewComponent } from './core/components/game-view/game-view.component';

export const appRoutes: Routes = [
    { path: 'game', component: GameViewComponent },
    { path: '', component: HomeComponent },
];
