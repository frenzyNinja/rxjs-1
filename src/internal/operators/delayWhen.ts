/** @prettier */
import { Observable } from '../Observable';
import { MonoTypeOperatorFunction } from '../types';
import { operate } from '../util/lift';
import { OperatorSubscriber } from './OperatorSubscriber';
import { concat } from '../observable/concat';
import { take } from './take';
import { ignoreElements } from './ignoreElements';

/* tslint:disable:max-line-length */
/** @deprecated In future versions, empty notifiers will no longer re-emit the source value on the output observable. */
export function delayWhen<T>(
  delayDurationSelector: (value: T, index: number) => Observable<never>,
  subscriptionDelay?: Observable<any>
): MonoTypeOperatorFunction<T>;
/** @deprecated In future versions, `subscriptionDelay` will no longer be supported. */
export function delayWhen<T>(
  delayDurationSelector: (value: T, index: number) => Observable<any>,
  subscriptionDelay?: Observable<any>
): MonoTypeOperatorFunction<T>;
/* tslint:disable:max-line-length */

/**
 * Delays the emission of items from the source Observable by a given time span
 * determined by the emissions of another Observable.
 *
 * <span class="informal">It's like {@link delay}, but the time span of the
 * delay duration is determined by a second Observable.</span>
 *
 * ![](delayWhen.png)
 *
 * `delayWhen` time shifts each emitted value from the source Observable by a
 * time span determined by another Observable. When the source emits a value,
 * the `delayDurationSelector` function is called with the source value as
 * argument, and should return an Observable, called the "duration" Observable.
 * The source value is emitted on the output Observable only when the duration
 * Observable emits a value or completes.
 * The completion of the notifier triggering the emission of the source value
 * is deprecated behavior and will be removed in future versions.
 *
 * Optionally, `delayWhen` takes a second argument, `subscriptionDelay`, which
 * is an Observable. When `subscriptionDelay` emits its first value or
 * completes, the source Observable is subscribed to and starts behaving like
 * described in the previous paragraph. If `subscriptionDelay` is not provided,
 * `delayWhen` will subscribe to the source Observable as soon as the output
 * Observable is subscribed.
 *
 * ## Example
 * Delay each click by a random amount of time, between 0 and 5 seconds
 * ```ts
 * import { fromEvent, interval } from 'rxjs';
 * import { delayWhen } from 'rxjs/operators';
 *
 * const clicks = fromEvent(document, 'click');
 * const delayedClicks = clicks.pipe(
 *   delayWhen(event => interval(Math.random() * 5000)),
 * );
 * delayedClicks.subscribe(x => console.log(x));
 * ```
 *
 * @see {@link delay}
 * @see {@link throttle}
 * @see {@link throttleTime}
 * @see {@link debounce}
 * @see {@link debounceTime}
 * @see {@link sample}
 * @see {@link sampleTime}
 * @see {@link audit}
 * @see {@link auditTime}
 *
 * @param {function(value: T, index: number): Observable} delayDurationSelector A function that
 * returns an Observable for each value emitted by the source Observable, which
 * is then used to delay the emission of that item on the output Observable
 * until the Observable returned from this function emits a value.
 * @param {Observable} subscriptionDelay An Observable that triggers the
 * subscription to the source Observable once it emits any value.
 * @return {Observable} An Observable that delays the emissions of the source
 * Observable by an amount of time specified by the Observable returned by
 * `delayDurationSelector`.
 * @name delayWhen
 */
export function delayWhen<T>(
  delayDurationSelector: (value: T, index: number) => Observable<any>,
  subscriptionDelay?: Observable<any>
): MonoTypeOperatorFunction<T> {
  if (subscriptionDelay) {
    // DEPRECATED PATH
    return (source: Observable<T>) =>
      concat(subscriptionDelay.pipe(take(1), ignoreElements()), source.pipe(delayWhen(delayDurationSelector)));
  }

  return operate((source, subscriber) => {
    // An index to give to the projection function.
    let index = 0;
    // Whether or not the source has completed.
    let isComplete = false;
    // Tracks the number of actively delayed values we have.
    let active = 0;

    /**
     * Checks to see if we can complete the result and completes it, if so.
     */
    const checkComplete = () => isComplete && !active && subscriber.complete();

    source.subscribe(
      new OperatorSubscriber(
        subscriber,
        (value: T) => {
          // Closed bit to guard reentrancy and
          // synchronous next/complete (which both make the same calls right now)
          let closed = false;

          /**
           * Notifies the consumer of the value.
           */
          const notify = () => {
            // Notify the consumer.
            subscriber.next(value);

            // Ensure our inner subscription is cleaned up
            // as soon as possible. Once the first `next` fires,
            // we have no more use for this subscription.
            durationSubscriber?.unsubscribe();

            if (!closed) {
              active--;
              closed = true;
              checkComplete();
            }
          };

          // We have to capture our duration subscriber so we can unsubscribe from
          // it on the first next notification it gives us.
          const durationSubscriber = new OperatorSubscriber(
            subscriber,
            notify,
            // Errors are sent to consumer.
            undefined,
            // TODO(benlesh): I'm inclined to say this is _incorrect_ behavior.
            // A completion should not be a notification. Note the deprecation above
            notify
          );

          active++;
          delayDurationSelector(value, index++).subscribe(durationSubscriber);
        },
        // Errors are passed through to consumer.
        undefined,
        () => {
          isComplete = true;
          checkComplete();
        }
      )
    );
  });
}
