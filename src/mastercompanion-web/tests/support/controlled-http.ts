import {
  HttpBackend,
  HttpClient,
  HttpRequest,
  HttpResponse,
  type HttpEvent,
} from '@angular/common/http';
import { map, Observable, Subject } from 'rxjs';

interface PendingRequest<TBody> {
  url: string;
  method: string;
  body: TBody;
  response: Subject<unknown>;
}

/** A controlled transport underneath the real Angular HttpClient. */
export class ControlledHttp<TBody> extends HttpBackend {
  readonly client = new HttpClient(this);
  readonly requests: PendingRequest<TBody>[] = [];

  constructor(private readonly decodeBody: (value: unknown) => TBody) {
    super();
  }

  override handle(request: HttpRequest<unknown>): Observable<HttpEvent<unknown>> {
    const response = new Subject<unknown>();
    this.requests.push({
      url: request.url,
      method: request.method,
      body: this.decodeBody(request.body),
      response,
    });
    return response.pipe(map((body) => new HttpResponse({ body })));
  }
}
