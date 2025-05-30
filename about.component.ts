import { Component, OnDestroy, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { Store } from '@ngrx/store';
import { Subscription } from 'rxjs';

import { DbService } from '@mm-services/db.service';
import { ResourceIconsService } from '@mm-services/resource-icons.service';
import { Selectors } from '@mm-selectors/index';
import { SessionService } from '@mm-services/session.service';
import { VersionService } from '@mm-services/version.service';
import { TranslateService } from '@mm-services/translate.service';
import { BrowserDetectorService } from '@mm-services/browser-detector.service';
import { ToolBarComponent } from '@mm-components/tool-bar/tool-bar.component';
import { MatCard, MatCardHeader, MatCardTitle, MatCardContent, MatCardSubtitle } from '@angular/material/card';
import { TranslateDirective, TranslatePipe } from '@ngx-translate/core';
import { MatButton } from '@angular/material/button';
import { NgSwitch, NgSwitchCase, NgIf, NgFor, DecimalPipe } from '@angular/common';
import { PartnerImagePipe } from '@mm-pipes/resource-icon.pipe';
import { SimpleDateTimePipe } from '@mm-pipes/date.pipe';

@Component({
  templateUrl: './about.component.html',
  imports: [
    ToolBarComponent,
    MatCard,
    MatCardHeader,
    MatCardTitle,
    TranslateDirective,
    MatCardContent,
    MatButton,
    NgSwitch,
    NgSwitchCase,
    NgIf,
    MatCardSubtitle,
    NgFor,
    DecimalPipe,
    TranslatePipe,
    PartnerImagePipe,
    SimpleDateTimePipe
  ]
})
export class AboutComponent implements OnInit, OnDestroy {
  subscription: Subscription = new Subscription();
  private dataUsageUpdate;
  browserSupport;

  // NEW for issue #6784: flag for Safari users
  public isSafari = false;

  userCtx;
  replicationStatus;
  partners;
  androidDataUsage;
  androidDeviceInfo;
  version;
  localRev;
  remoteRev;
  dbInfo;
  url;
  doorTimeout;
  knockCount = 0;

  constructor(
    private dbService: DbService,
    private store: Store,
    private resourceIconsService: ResourceIconsService,
    private sessionService: SessionService,
    private versionService: VersionService,
    private translateService: TranslateService,
    private browserDetectorService: BrowserDetectorService,
    private router: Router
  ) { }

  ngOnInit() {
    this.subscribeToStore();

    this.url = window.location.hostname;
    this.userCtx = this.sessionService.userCtx();

    this.getPartners();
    this.getVersionAndRevisions();

    this.getAndroidDataUsage();
    this.getAndroidDeviceInfo();
    this.getDbInfo();
    this.getBrowserSupport();
  }

  ngOnDestroy() {
    clearTimeout(this.doorTimeout);
    clearInterval(this.dataUsageUpdate);
    this.subscription.unsubscribe();
  }

  private subscribeToStore() {
    const subscription = this.store
      .select(Selectors.getReplicationStatus)
      .subscribe(replicationStatus => this.replicationStatus = replicationStatus);
    this.subscription.add(subscription);
  }

  private getPartners() {
    this.resourceIconsService
      .getDocResources('partners')
      .then(partners => this.partners = partners)
      .catch(error => {
        if (error.status !== 404) { // Partners doc is not compulsory.
          console.error('Error fetching "partners" doc', error);
        }
      });
  }

  private getVersionAndRevisions() {
    this.versionService
      .getLocal()
      .then(({ version, rev }) => {
        this.version = version;
        this.localRev = rev;
      })
      .catch(error => {
        console.error('Could not access local version', error);
      });

    this.versionService
      .getRemoteRev()
      .catch(error => {
        console.debug('Could not access remote ddoc rev', error);
        return this.translateService.get('app.version.unknown');
      })
      .then(rev => this.remoteRev = rev);
  }

  private refreshAndroidDataUsage() {
    this.androidDataUsage = JSON.parse((<any>window).medicmobile_android.getDataUsage());
  }

  private getAndroidDataUsage() {
    if ((<any>window).medicmobile_android && typeof (<any>window).medicmobile_android.getDataUsage === 'function') {
      this.refreshAndroidDataUsage();
      this.dataUsageUpdate = setInterval(() => this.refreshAndroidDataUsage(), 2000);
    }
  }

  private getAndroidDeviceInfo() {
    if ((<any>window).medicmobile_android && typeof (<any>window).medicmobile_android.getDeviceInfo === 'function') {
      this.androidDeviceInfo = JSON.parse((<any>window).medicmobile_android.getDeviceInfo());
    }
  }

  private getDbInfo() {
    this.dbService
      .get()
      .info()
      .then(result => this.dbInfo = result)
      .catch(error => {
        console.error('Failed to fetch DB info', error);
      });
  }

  private getBrowserSupport() {
    const isUsingSupportedBrowser = this.browserDetectorService.isUsingSupportedBrowser();
    const isUsingChtAndroid = this.browserDetectorService.isUsingChtAndroid();
    const isUsingChtAndroidV1 = this.browserDetectorService.isUsingChtAndroidV1();

    let outdatedComponent;
    // 2) NEW for issue #6784 catch plain Safari first, set the flag, and exit
    if (this.browserDetectorService.isSafari()) {
      this.isSafari = true;                       
      this.browserSupport = {
        isUsingSupportedEnvironment: false,
        outdatedComponent: 'safari'
      };
      return;                                          // NEW: skip the rest
    } 
    if (isUsingChtAndroid) {
      if (!isUsingChtAndroidV1) {
        outdatedComponent = 'chtAndroid';
      } else if (!isUsingSupportedBrowser) {
        outdatedComponent = 'webviewApk';
      }
    } else if (!isUsingSupportedBrowser) {
      outdatedComponent = 'browser';
    }

    this.browserSupport = {
      isUsingSupportedEnvironment: typeof outdatedComponent === 'undefined',
      outdatedComponent,
    };
  }

  reload() {
    window.location.reload();
  }

  secretDoor() {
    if (this.doorTimeout) {
      clearTimeout(this.doorTimeout);
    }

    if (this.knockCount++ >= 5) {
      this.router.navigate(['/testing']);
      return;
    }

    this.doorTimeout = setTimeout(() => this.knockCount = 0, 1000);
  }
}
