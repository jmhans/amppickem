import { ComponentFixture, TestBed } from '@angular/core/testing';

import { NflScoresComponent } from './nfl-scores.component';

describe('NflScoresComponent', () => {
  let component: NflScoresComponent;
  let fixture: ComponentFixture<NflScoresComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [NflScoresComponent]
    });
    fixture = TestBed.createComponent(NflScoresComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
