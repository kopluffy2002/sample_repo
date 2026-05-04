import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';

@Injectable({
  providedIn: 'root'
})
export class ForgotPasswordService {
  private apiUrl = 'http://localhost:3000';

  constructor(private http: HttpClient) {}

  forgotPassword(email: string, username: string, newPassword: string) {
    console.log('Reached to service:');
    const data = {
      email: email,
      username: username,
      newPassword: newPassword
    };

    // Make a POST request to your server's forgot password endpoint
    return this.http.post(`${this.apiUrl}/forgotPassword`, data);
  }
}
