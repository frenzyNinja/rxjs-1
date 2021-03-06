import { expect } from 'chai';
import { EmptyError } from 'rxjs';

/** @test {EmptyError} */
describe('EmptyError', () => {
  const error = new EmptyError();
  it('Should have a name', () => {
    expect(error.name).to.be.equal('EmptyError');
  });
  it('Should have a message', () => {
    expect(error.message).to.be.equal('no elements in sequence');
  });
  it('Should have a stack', () => {
    expect(error.stack).to.be.a('string');
  });
});
