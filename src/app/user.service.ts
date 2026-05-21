import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { environment } from 'src/environments/environment.prod';

@Injectable({
  providedIn: 'root',
})
export class UserService {
  private apiUrl = environment.apiUrl;

  constructor(private http: HttpClient) {}

  getUserData(username: string): Observable<any> {
    // Make an HTTP GET request to the server's /account/userdata route with the username parameter
    return this.http
      .get(`${this.apiUrl}/account/userdata?username=${username}`)
      .pipe(catchError(this.handleError));
  }

  updateUserData(userData: any): Observable<any> {
    // Make an HTTP PUT request to update user data
    return this.http
      .put(`${this.apiUrl}/account/updatedata`, userData)
      .pipe(catchError(this.handleError));
  }

  changePassword(username: string, newPassword: string): Observable<any> {
    // Make an HTTP PUT request to change the user's password
    return this.http
      .put(`${this.apiUrl}/account/changepassword`, { username, newPassword })
      .pipe(catchError(this.handleError));
  }

  getUserPrivacy(username: string): Observable<any> {
    // Define a method to get user privacy status from the server
    return this.http
      .get(`${this.apiUrl}/account/fetchprivacy/${username}`)
      .pipe(catchError(this.handleError));
  }

  updateUserPrivacy(username: string, newPrivacy: string): Observable<any> {
    // Define a method to update user privacy status on the server
    return this.http
      .post(`${this.apiUrl}/account/updateprivacy/${username}`, {
        privacy: newPrivacy,
      })
      .pipe(catchError(this.handleError));
  }

  deleteUserAccount(username: string): Observable<any> {
    // Define a method to delete the user's account on the server
    return this.http
      .delete(`${this.apiUrl}/account/userdelete/${username}`)
      .pipe(catchError(this.handleError));
  }

  private handleError(error: HttpErrorResponse) {
    let errorMessage = 'An error occurred';
    if (error.error instanceof ErrorEvent) {
      // Client-side error
      errorMessage = `Error: ${error.error.message}`;
    } else {
      // Server-side error
      errorMessage = `Error Code: ${error.status}, Message: ${error.error.message || 'Unknown error'}`;
    }
    console.error(errorMessage);
    return throwError(errorMessage);
  }
}
