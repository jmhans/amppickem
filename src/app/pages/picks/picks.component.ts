import { Component, OnInit } from '@angular/core';
import { ApiService } from './../../services/api.service';
import { Title } from '@angular/platform-browser';
import { Observable } from 'rxjs';

@Component({
  selector: 'app-picks',
  templateUrl: './picks.component.html',
  styleUrls: ['./picks.component.scss']
})
export class PicksComponent implements OnInit {
pageTitle: string = 'Picks';
picks$: Observable<any[]>;

  constructor(
    private title: Title,
    public api: ApiService,
  ) { }

  ngOnInit() {
    this.title.setTitle(this.pageTitle);
    this.picks$ = this.api.getNFLGames$()

  }

}
