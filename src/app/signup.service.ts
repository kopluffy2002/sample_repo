import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from 'src/environments/environment.prod';

@Injectable({
  providedIn: 'root',
})
export class SignupService {
  private apiUrl = environment.apiUrl; // ← pulls from environment file automatically

  constructor(private http: HttpClient) {}

  signup(user: any) {
    console.log('Sending signup request with user data:', user);
    return this.http.post(`${this.apiUrl}/signup`, user);
  }
}
