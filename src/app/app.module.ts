import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { FormsModule } from '@angular/forms';
import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { ReactiveFormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { SignupComponent } from './signup/signup.component';
import { LoginComponent } from './login/login.component';
import { HomeComponent } from './home/home.component';
import { HttpClientModule } from '@angular/common/http';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { LoginSignupComponent } from './login-signup/login-signup.component';
import { HeaderComponent } from './header/header.component';
import { CalendarComponent } from './calendar/calendar.component';
import { CalendarService } from './calendar.service';
import { MessageComponent } from './message/message.component';
import { FriendsComponent } from './friends/friends.component';
import { FriendsService } from './friends.service';
import { UserService } from './user.service';
import { AccountComponent } from './account/account.component';
import { AccountService } from './account.service';
import { ForgotPasswordComponent } from './forgot-password/forgot-password.component';
import { NotificationsComponent } from './notifications/notifications.component';

@NgModule({
  declarations: [
    AppComponent,
    SignupComponent,
    LoginComponent,
    HomeComponent,
    LoginSignupComponent,
    HeaderComponent,
    CalendarComponent,
    MessageComponent,
    FriendsComponent,
    AccountComponent,
    ForgotPasswordComponent,
    NotificationsComponent
  ],
  imports: [
    BrowserModule,
    FormsModule,
    ReactiveFormsModule,
    HttpClientModule,
    AppRoutingModule,
    BrowserAnimationsModule,
    MatCardModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatSnackBarModule
  ],
  providers: [FriendsService,AccountService,UserService,CalendarService],
  bootstrap: [AppComponent]
})
export class AppModule {}