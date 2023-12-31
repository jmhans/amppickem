import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { HomeComponent } from './pages/home/home.component';
import { AuthGuard } from '@auth0/auth0-angular';
import { PicksComponent } from './pages/picks/picks.component';


const routes: Routes = [{
  path: '',
  component: HomeComponent,
  canActivate: [AuthGuard],
  pathMatch: 'full'
},
{
  path: 'picks',
  component: PicksComponent,
  canActivate: [AuthGuard]
}

];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }
