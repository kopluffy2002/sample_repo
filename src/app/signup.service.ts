import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';

@Injectable({
  providedIn: 'root'
})
export class SignupService {
  private apiUrl = 'http://localhost:3000';

  constructor(private http: HttpClient) {}  

  signup(user: any) {
    console.log('Sending signup request with user data:', user);
    return this.http.post(`${this.apiUrl}/signup`, user);
  }
}
