import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';

@Injectable({
  providedIn: 'root'
})
export class FriendsService {
  private apiUrl = 'http://localhost:3000';

  constructor(private http: HttpClient) {}

  getPrimaryFriends(username: string) {
    return this.http.get(`${this.apiUrl}/friends/primary/${username}`);
  } 

  getRequestFriends(username: string) {
    return this.http.get(`${this.apiUrl}/friends/request/${username}`);
  } 
  getFriendSuggestions(username: string) {
    return this.http.get(`${this.apiUrl}/friends/suggestions/${username}`);
  }

  addFriend(username: string, friendUsername: string) {
    return this.http.post(`${this.apiUrl}/friends/add`, { username, friendUsername });
  }

  acceptFriendRequest(username: string, friendUsername: string) {
    return this.http.post(`${this.apiUrl}/friends/accept`, { username, friendUsername });
  }

  deleteFriendRequest(username: string, friendUsername: string) {
    return this.http.post(`${this.apiUrl}/friends/delete`, { username, friendUsername });
  }
  getUserDetails(username: string) {
    return this.http.get(`${this.apiUrl}/friends/users/${username}`);
  }
  unfriend(username: string, friendUsername: string) {
    return this.http.post(`${this.apiUrl}/friends/unfriend`, { username, friendUsername });
  }
  getPrivacySetting(username: string) {
    return this.http.get(`${this.apiUrl}/users/privacy/${username}`);
  }
  getSchedule(username: string) {
    return this.http.get(`${this.apiUrl}/users/schedule/${username}`);
  }
  getAllGroups(username: string) {
    return this.http.get(`${this.apiUrl}/groups/${username}`);
  }
}
