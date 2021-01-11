export default class
{
  private multiplyScore = document.getElementById('scoreMultiplier')!;
  private currentScore = document.getElementById('currentScore')!;

  private downloadButton = document.getElementById('download');
  private newScore = document.getElementById('newBestScore')!;
  private bestScore = document.getElementById('bestScore')!;

  private pauseScreen = document.getElementById('pause')!;
  private currentSong = document.getElementById('song')!;
  private menuButton = document.getElementById('menu')!;

  private score = document.getElementById('score')!;
  private intro = document.getElementById('intro')!;

  private end = document.getElementById('end')!;
  private ui = document.getElementById('ui')!;

  private installPrompt: (event: PromptEvent) => void;
  private setTrack: (event: CustomEventInit) => void;
  private update: (event: CustomEventInit) => void;
  private toggleMenu: (event: MouseEvent) => void;
  private download: (event: MouseEvent) => void;

  private savedScore = this.savedBestScore;
  private restartEvent: CustomEvent<void>;
  private startEvent: CustomEvent<void>;
  private prompt?: PromptEvent;

  private scoreMultiplier = 0;
  private lastMultiplier = 0;

  private restart: () => void;
  private start: () => void;

  private bonusTime?: number;
  private callback?: number;

  private gameOver = false;
  private autoplay = false;
  private pause = false;

  public constructor () {
    this.start = this.onStart.bind(this);
    this.update = this.onUpdate.bind(this);
    this.restart = this.onRestart.bind(this);
    this.setTrack = this.setNewTrack.bind(this);

    this.download = this.onDownload.bind(this);
    this.toggleMenu = this.onMenuToggle.bind(this);
    this.installPrompt = this.onInstallPrompt.bind(this);

    window.addEventListener('beforeinstallprompt', this.installPrompt);
    this.downloadButton?.addEventListener('click', this.download);
    this.menuButton.addEventListener('click', this.toggleMenu);

    document.addEventListener('score:update', this.update);
    document.addEventListener('new:song', this.setTrack);

    this.restartEvent = new CustomEvent('game:restart');
    this.startEvent = new CustomEvent('game:start');
  }

  public playIntro (callback: () => void): void {
    this.intro.addEventListener('click', this.start);
    this.callback = setTimeout(callback, 4500);
    this.intro.classList.add('start');
  }

  private onStart (): void {
    this.intro.removeEventListener('click', this.start);
    document.dispatchEvent(this.startEvent);

    this.intro.classList.add('fadeOut');
    this.ui.classList.add('fadeIn');
    clearTimeout(this.callback);
  }

  private onUpdate (event: CustomEventInit): void {
    const { score, multiplier } = event.detail;
    this.scoreMultiplier += multiplier;

    const currentScore = score + this.scoreMultiplier;
    this.score.textContent = currentScore;

    if (this.lastMultiplier !== multiplier) {
      this.bonusTime = setTimeout(this.onBonusEnd.bind(this), 2000);
      this.multiplyScore.textContent = `x${multiplier + 1}`;

      this.multiplyScore.classList.add('animate');
      this.lastMultiplier = multiplier;
    }

    if (this.savedScore < currentScore) {
      localStorage.setItem('Best Score', currentScore);
      this.newScore.classList.add('animate');
    }
  }

  public setNewTrack (event: CustomEventInit): void {
    this.currentSong.textContent = event.detail.song;
  }

  private onBonusEnd (): void {
    this.multiplyScore.classList.remove('animate');
  }

  public showGameOver (): void {
    this.end.addEventListener('click', this.restart);
    setTimeout(() => this.end.classList.add('interactable'), 1250);

    this.bestScore.textContent = this.savedBestScore.toString();
    this.currentScore.textContent = this.score.textContent;

    this.pauseScreen.classList.remove('fadeIn');
    this.newScore.classList.remove('animate');
    this.menuButton.classList.remove('open');

    this.ui.classList.remove('fadeIn');
    this.end.classList.add('fadeIn');

    clearTimeout(this.bonusTime);
    this.gameOver = true;
  }

  private onInstallPrompt (event: PromptEvent): void {
    this.prompt = event;
  }

  private onMenuToggle (event: MouseEvent): void {
    if (this.gameOver) return;
    this.pause = !this.pause;

    setTimeout(() =>
      document.dispatchEvent(new CustomEvent('game:pause', {
        detail: { autoplay: this.autoplay }
      })
    ), ~~!this.pause * 500);

    if (!this.pause) {
      this.pauseScreen.classList.remove('fadeIn');
      this.menuButton.classList.remove('open');
    }

    else {
      this.pauseScreen.classList.add('fadeIn');
      this.menuButton.classList.add('open');
    }
  }

  private onDownload (event: MouseEvent): void {
    this.prompt?.prompt();

    this.prompt?.userChoice.then(choice => {
      choice.outcome === 'accepted' && (
        event.target as HTMLButtonElement
      ).classList.add('hidden');

      this.prompt = undefined;
    });
  }

  private onRestart (): void {
    this.end.removeEventListener('click', this.restart);
    document.dispatchEvent(this.restartEvent);
    this.savedScore = this.savedBestScore;

    this.end.classList.remove('interactable');
    this.end.classList.remove('fadeIn');
    this.ui.classList.add('fadeIn');

    this.score.textContent = '0';
    this.scoreMultiplier = 0;
    this.lastMultiplier = 0;
    this.gameOver = false;
  }

  private get savedBestScore (): number {
    return +(localStorage.getItem('Best Score') ?? '0');
  }
}
