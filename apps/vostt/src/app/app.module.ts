import { BrowserModule } from '@angular/platform-browser';
import { NgModule } from '@angular/core';

import { AppComponent } from './app.component';
import { HttpClientModule } from '@angular/common/http';
import { MainModule } from './core/main.module';
import { RouterModule } from '@angular/router';
import { appRoutes } from './app.routes';

@NgModule({
    declarations: [AppComponent],
    imports: [
        BrowserModule,
        HttpClientModule,
        RouterModule.forRoot(appRoutes),
        MainModule,
    ],
    providers: [],
    bootstrap: [AppComponent]
})
export class AppModule {}
