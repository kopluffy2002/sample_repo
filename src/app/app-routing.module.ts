import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { LoginComponent } from './login/login.component'; 
import { SignupComponent } from './signup/signup.component';
import { HomeComponent } from './home/home.component';
import { LoginSignupComponent } from './login-signup/login-signup.component';
import { HeaderComponent } from './header/header.component';
import { CalendarComponent} from './calendar/calendar.component';
import { AccountComponent } from './account/account.component';
import { FriendsComponent } from './friends/friends.component';
import { MessageComponent } from './message/message.component';
import { NotificationsComponent } from './notifications/notifications.component';
import { ForgotPasswordComponent } from './forgot-password/forgot-password.component';

const routes: Routes = [
  { path: 'login', component: LoginComponent }, 
  { path: 'signup', component: SignupComponent },
  { path: 'home', component: HomeComponent },
  { path: 'login-signup', component: LoginSignupComponent},
  { path: 'header', component: HeaderComponent},
  { path: 'calendar', component: CalendarComponent},
  { path: 'account', component: AccountComponent},
  { path: 'friends', component: FriendsComponent},
  { path: 'message', component: MessageComponent},
  {path: 'account', component: AccountComponent},
  {path: 'forgot-password', component:ForgotPasswordComponent },
  {path: 'notifications', component: NotificationsComponent},
  { path: '', component: LoginSignupComponent}

];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }
