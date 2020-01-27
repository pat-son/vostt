import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { GameViewComponent } from './components/game-view/game-view.component';
import { HomeComponent } from './components/home/home.component';
import { HeaderComponent } from './components/header/header.component';

@NgModule({
    declarations: [
        GameViewComponent,
        HomeComponent,
        HeaderComponent,
    ],
    imports: [ CommonModule ],
    exports: [
        HomeComponent,
        GameViewComponent,
        HeaderComponent,
    ],
    providers: [],
})
export class MainModule {}
