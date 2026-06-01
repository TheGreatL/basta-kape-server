import { HttpException } from './http.exception';

export class BadRequestException extends HttpException {
    constructor(message = 'The request was invalid or could not be understood by the server.') {
        super(400, message);
    }
}

export class UnauthorizedException extends HttpException {
    constructor(message = 'Authentication is required and has failed or has not yet been provided.') {
        super(401, message);
    }
}

export class ForbiddenException extends HttpException {
    constructor(message = 'You do not have permission to access this resource.') {
        super(403, message);
    }
}

export class NotFoundException extends HttpException {
    constructor(message = 'The requested resource could not be found.') {
        super(404, message);
    }
}

export class ConflictException extends HttpException {
    constructor(message = 'The request conflicts with the current state of the server.') {
        super(409, message);
    }
}

export class UnprocessableEntityException extends HttpException {
    constructor(message = 'The request was well-formed but was unable to be followed due to semantic errors.') {
        super(422, message);
    }
}

export class TooManyRequestsException extends HttpException {
    constructor(message = 'You have sent too many requests in a given amount of time.') {
        super(429, message);
    }
}

export class InternalServerException extends HttpException {
    constructor(message = 'An unexpected internal server error occurred.') {
        super(500, message, false); // false implies it might not be a known operational error
    }
}

export class NotImplementedException extends HttpException {
    constructor(message = 'The server does not support the functionality required to fulfill the request.') {
        super(501, message);
    }
}
