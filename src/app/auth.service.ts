import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { BehaviorSubject, Observable, of, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';


@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private apiUrl = 'http://localhost:3000';
  private remindersSubject = new BehaviorSubject<any[]>([]);

  constructor(private http: HttpClient) {}

  // Check if the user is logged in and get user data from the server
  checkLoginStatus(): Observable<any> {
    return this.http.get(`${this.apiUrl}/check-login`).pipe(
      catchError((error: HttpErrorResponse) => {
        return throwError(error);
      })
    );
  }
  login(email: string, password: string): Observable<any> {
    const user = { email, password };
    return this.http.post<any>(`${this.apiUrl}/login`, user).pipe(
      catchError((error: HttpErrorResponse) => {
        if (error.status === 200) {
          const response = error.error;
          if (response.username) {
            console.log('Setting username in sessionStorage:', response.username);
            sessionStorage.setItem('username', response.username);
          }
        } else if (error.status === 401) {
          return of({ message: 'Invalid password' });
        } else if (error.status === 404) {
          return of({ message: 'Email not found' });
        } else if (error.status === 500) {
          return of({ message: 'Server error' });
        }
        return throwError(error);
      })
    );
  }
    

  // Check if the user is logged in based on session storage
  isLoggedIn(): boolean {
    return !!sessionStorage.getItem('username');
  }

  getReminders(): Observable<any[]> {
    const username = sessionStorage.getItem('username');
    if (!username) {
      return throwError('Username not found in session storage');
    }

    const url = `${this.apiUrl}/get-reminders?username=${encodeURIComponent(username)}`;
    
    this.http.get<any[]>(url).pipe(
      catchError((error: HttpErrorResponse) => {
        return throwError(error);
      })
    ).subscribe(
      (reminders) => {
        this.remindersSubject.next(reminders);
      },
      (error) => {
        console.error('Error fetching reminders:', error);
      }
    );

    return this.remindersSubject.asObservable();
  }
}
