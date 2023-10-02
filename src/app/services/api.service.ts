// src/app/core/api.service.ts
import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpErrorResponse } from '@angular/common/http';
import { throwError as ObservableThrowError, Observable } from 'rxjs';
import { catchError, map , tap} from 'rxjs/operators';



@Injectable({
  providedIn: 'root'
})
export class ApiService {

  private base_api= '/api/'

  constructor(
    private http: HttpClient,
  ) { }

    getNFLGames$(): Observable<any[]> {
      return this.http
        .get<any[]>(`${this.base_api}nflgames`)
        .pipe(
          catchError((error) => this._handleError(error))
        )

    }




  private _handleError(err: HttpErrorResponse | any): Observable<any> {
    const errorMsg = err.message || 'Error: Unable to complete request.';
    return ObservableThrowError(errorMsg);
  }





}
