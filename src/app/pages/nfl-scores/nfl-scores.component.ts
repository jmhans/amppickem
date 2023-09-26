import { Component, OnInit } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { HttpClient, HttpHeaders, HttpErrorResponse } from '@angular/common/http';
import { Observable, map } from 'rxjs';


@Component({
  selector: 'app-nfl-scores',
  templateUrl: './nfl-scores.component.html',
  styleUrls: ['./nfl-scores.component.scss']
})
export class NflScoresComponent implements OnInit{
  pageTitle = 'Home';
  base_api = '/api/'
  score_obs$: Observable<any[]>
  constructor(private title: Title,
    private http: HttpClient
    ) { }
  ngOnInit() {

    this.title.setTitle(this.pageTitle);
    this.score_obs$ = this.http.get<any[]>(`${this.base_api}nfl/scoreboard`).pipe(map((data: any)=> {
      return data.events
    }))
  }


}
