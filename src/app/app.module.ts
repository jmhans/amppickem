import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';

import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { HeaderComponent } from './header/header.component';
import { FooterComponent } from './footer/footer.component';

import { AuthModule } from '@auth0/auth0-angular';
import { AuthHttpInterceptor } from '@auth0/auth0-angular';
import { AuthButtonComponent } from './auth/auth-button/auth-button.component';
import { UserProfileComponent } from './auth/user-profile/user-profile.component';
import { HomeComponent } from './pages/home/home.component';
import { NflScoresComponent } from './pages/nfl-scores/nfl-scores.component';

import { HttpClientModule, HTTP_INTERCEPTORS }    from '@angular/common/http';

import { PicksComponent } from './pages/picks/picks.component';

import { LocalMaterialModule } from './core/local-material-module/local-material.module'

@NgModule({
  declarations: [
    AppComponent,
    HeaderComponent,
    FooterComponent,
    AuthButtonComponent,
    UserProfileComponent,
    HomeComponent,
    NflScoresComponent,
    PicksComponent
  ],
  imports: [
    BrowserModule,
    AppRoutingModule,
    HttpClientModule,
    LocalMaterialModule,
    AuthModule.forRoot({
      domain: 'actuarialgames.auth0.com',
      clientId: 'EHKa7RHnXAJgasX4KcBjKl3y1IceDa2H',
      authorizationParams: {
        redirect_uri: window.location.origin
      },
      httpInterceptor: {
        allowedList: [
          '/api',
          '/api/*'
        ]
      }
    })
  ],
  providers: [
    { provide: HTTP_INTERCEPTORS, useClass: AuthHttpInterceptor, multi: true }
],
  bootstrap: [AppComponent]
})
export class AppModule { }
