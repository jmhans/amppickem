import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';

import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { HeaderComponent } from './header/header.component';
import { FooterComponent } from './footer/footer.component';

import { AuthModule } from '@auth0/auth0-angular';
import { AuthButtonComponent } from './auth/auth-button/auth-button.component';
import { UserProfileComponent } from './auth/user-profile/user-profile.component';
import { HomeComponent } from './pages/home/home.component';
import { NflScoresComponent } from './pages/nfl-scores/nfl-scores.component';

import { HttpClientModule }    from '@angular/common/http';


@NgModule({
  declarations: [
    AppComponent,
    HeaderComponent,
    FooterComponent,
    AuthButtonComponent,
    UserProfileComponent,
    HomeComponent,
    NflScoresComponent
  ],
  imports: [
    BrowserModule,
    AppRoutingModule,
    HttpClientModule,
    AuthModule.forRoot({
      domain: 'actuarialgames.auth0.com',
      clientId: 'EHKa7RHnXAJgasX4KcBjKl3y1IceDa2H',
      authorizationParams: {
        redirect_uri: window.location.origin
      }
    })
  ],
  providers: [],
  bootstrap: [AppComponent]
})
export class AppModule { }
